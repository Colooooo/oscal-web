import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { applicationOrigin, createVercelHandler } from './runtime.mjs';
import { openDatabase, createHandler } from './index.mjs';
import { initializeCatalog } from './catalog.mjs';
import { clientAddress, readBody } from './security.mjs';

test('Vercel uses configured production origin, isolated previews and no SQLite fallback', async () => {
    assert.equal(applicationOrigin({ VERCEL: '1', PUBLIC_URL: 'https://oscal-pink.vercel.app/' }), 'https://oscal-pink.vercel.app');
    assert.equal(applicationOrigin({ VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_URL: 'oscal-preview.vercel.app', PUBLIC_URL: 'https://oscal-pink.vercel.app' }), 'https://oscal-preview.vercel.app');
    assert.equal(applicationOrigin({ VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'oscal-pink.vercel.app' }), 'https://oscal-pink.vercel.app');
    assert.throws(() => applicationOrigin({ VERCEL:'1', PUBLIC_URL:'http://localhost:5173' }), /HTTPS/);
    assert.throws(() => applicationOrigin({ PUBLIC_URL:'https://oscal-pink.vercel.app/path' }), /origen/);
    await assert.rejects(openDatabase({ VERCEL:'1' }), /DATABASE_URL/);
    const req = { headers: { 'x-vercel-forwarded-for':'192.0.2.20', 'x-forwarded-for':'spoofed', 'x-real-ip':'spoofed' }, socket: { remoteAddress:'127.0.0.1' } };
    assert.equal(clientAddress(req, [], true), '192.0.2.20');
    assert.equal(clientAddress(req), '127.0.0.1');
    req.headers['x-vercel-forwarded-for'] = '192.0.2.20,spoofed';
    assert.equal(clientAddress(req, [], true), 'unknown');
});

test('warm functions initialize once and failed initialization can retry without leaking secrets', async () => {
    let connections = 0, attached = 0, closed = 0;
    const handler = createVercelHandler({ env:{DATABASE_URL:'private-connection'}, connect:async () => { connections++; return {pool:{},close:async()=>{closed++;}}; },
        create:async () => ({handler:async (_req,res) => {res.end('ok');}}), attachPool:()=>{attached++;} });
    const results = await Promise.all(Array.from({length:3}, async () => {const res = {end(body){this.body=body;}};await handler({},res);return res.body;}));
    assert.deepEqual(results,['ok','ok','ok']);
    assert.equal(connections,1);assert.equal(attached,1);assert.equal(closed,0);
    let attempts=0;
    const retry = createVercelHandler({env:{DATABASE_URL:'private-connection'},connect:async()=>{if(++attempts===1)throw new Error('private-connection');return {pool:{},close:async()=>{}};},
        create:async()=>({handler:async(_req,res)=>res.end('ok')}),attachPool:()=>{},log:()=>{}});
    const failure={writeHead(status){this.status=status;},end(body){this.body=body;}};
    await retry({},failure);assert.equal(failure.status,503);assert.doesNotMatch(failure.body,/private-connection/);
    const success={end(body){this.body=body;}};await retry({},success);assert.equal(success.body,'ok');
});

test('Vercel parsed JSON retains the body limit and rejects invalid JSON', async () => {
    assert.deepEqual(await readBody({body:{hello:'world'},destroy(){}}),{hello:'world'});
    assert.deepEqual(await readBody({body:Buffer.from('{"hello":"world"}'),destroy(){}}),{hello:'world'});
    await assert.rejects(readBody({body:{text:'x'.repeat(20001)},destroy(){}}),error=>error.status===413);
    await assert.rejects(readBody({body:'invalid json',destroy(){}}),SyntaxError);
});

test('serverless handler supports HTTPS registration, cookies, ownership and background mail with a parsed body', async t => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE orders(id TEXT PRIMARY KEY,token TEXT,data TEXT,total INTEGER,status TEXT,preference TEXT,payment TEXT,created TEXT)');
    await initializeCatalog(db,JSON.parse(readFileSync(new URL('../shared/catalog.json',import.meta.url),'utf8')));
    const background=[], mail=[];
    const {handler} = await createHandler({ db, env:{ VERCEL:'1',PUBLIC_URL:'https://oscal-pink.vercel.app',NODE_ENV:'production',PAYMENTS_ENABLED:'false' },
        background:promise=>background.push(promise),mailer:async message=>{mail.push(message);} });
    const server = createServer(async(req,res)=>{
        if (req.method==='POST') {let data='';for await(const chunk of req)data+=chunk;req.body=JSON.parse(data);}
        await handler(req,res);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});
    const base=`http://127.0.0.1:${server.address().port}`;
    const headers={Origin:'https://oscal-pink.vercel.app','Content-Type':'application/json','X-Vercel-Forwarded-For':'192.0.2.1'};
    const profile={name:'Fixture',email:'serverless@example.com',password:'long serverless fixture password'};
    const wrong=await fetch(base+'/api/auth/register',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:JSON.stringify(profile)});
    assert.equal(wrong.status,403);
    const register=await fetch(base+'/api/auth/register',{method:'POST',headers,body:JSON.stringify(profile)});
    assert.equal(register.status,200);assert.match(register.headers.get('set-cookie'),/HttpOnly; SameSite=Lax;.*Secure/);
    const cookie=register.headers.get('set-cookie').split(';')[0];
    await Promise.all(background);assert.equal(mail.length,1);assert.equal(background.length,1);
    const catalog=await (await fetch(base+'/api/catalog?q=&page=1',{headers})).json();
    const request={requestKey:'ef'.repeat(32),items:[{id:catalog.products[0].id,quantity:1}],customer:{name:'Fixture',email:profile.email,phone:'099000000',delivery:'pickup'}};
    const saved=await fetch(base+'/api/orders',{method:'POST',headers:{...headers,Cookie:cookie},body:JSON.stringify(request)});
    assert.equal(saved.status,201);const order=await saved.json();
    assert.equal((await fetch(base+`/api/orders/${order.id}`,{headers})).status,404);
    assert.equal((await fetch(base+`/api/orders/${order.id}`,{headers:{...headers,Cookie:cookie}})).status,200);
    assert.equal((await fetch(base+'/api/unknown',{headers})).status,404);
});
