import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { initializeCatalog, importCatalog, selectedCatalog, catalogPage } from './catalog.mjs'
import { createPayments } from './payments.mjs'
import { validateOrder } from './commerce.mjs'
const seed={demo:true,currency:'UYU',products:[{id:'A',name:'Cerámica',category:'Bazar',description:'Fixture',price:100,stock:10}]}
function fixture(t,mp) {
  const db=new DatabaseSync(':memory:');t.after(()=>db.close())
  db.exec('CREATE TABLE orders(id TEXT PRIMARY KEY,token TEXT,data TEXT,total INTEGER,status TEXT,preference TEXT,payment TEXT,created TEXT);CREATE TABLE order_users(order_id TEXT PRIMARY KEY,user_id TEXT)')
  initializeCatalog(db,seed)
  importCatalog(db,{...seed,demo:false,products:seed.products.map(p=>({...p,published:true}))},{replace:true,resetStock:true})
  return {db,payments:createPayments(db,{origin:'https://audit.example',mp})}
}
const input=()=>({requestKey:'ab'.repeat(32),items:[{id:'A',quantity:2}],customer:{name:'Test',email:'test@example.com',phone:'099000000',delivery:'pickup'}})
const user={id:'user',email:'test@example.com',verified:1}
test('checkout retries reuse one reservation and preference; blocks parallel attempts',async t=>{
  let calls=0,release
  const barrier=new Promise(resolve=>{release=resolve})
  const {db,payments}=fixture(t,async()=>{calls++;await barrier;return {id:'preference',init_point:'https://www.mercadopago.com.uy/checkout/test'}})
  const first=payments.checkout(input(),user)
  await assert.rejects(payments.checkout(input(),user),/revisión/)
  await assert.rejects(payments.checkout({...input(),requestKey:'cd'.repeat(32)},user),/pendiente/)
  release();const saved=await first
  assert.deepEqual(await payments.checkout(input(),user),saved)
  assert.equal(calls,1);assert.equal(db.prepare('SELECT available FROM inventory').get().available,8)
  await assert.rejects(payments.checkout({...input(),items:[{id:'A',quantity:1}]},user),/otro pedido/)
})
test('unverified accounts cannot reserve inventory; provider failures keep one reviewable attempt',async t=>{
  const {db,payments}=fixture(t,async()=>{throw new Error('timeout')})
  await assert.rejects(payments.checkout(input(),{...user,verified:0}),/confirmá/)
  assert.equal(db.prepare('SELECT available FROM inventory').get().available,10)
  await assert.rejects(payments.checkout(input(),user),/revisión/)
  await assert.rejects(payments.checkout(input(),user),/revisión/)
  assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get().n,1)
})
test('reservation release fails closed for pending payments and releases exactly once after verified expiry',async t=>{
  let pending=true,id
  const {db,payments}=fixture(t,async path=>{
    if(path==='/checkout/preferences') return {id:'pref',init_point:'https://www.mercadopago.com.uy/checkout/test'}
    if(path.includes('/checkout/preferences/')) return {external_reference:id,expires:true,expiration_date_to:new Date(Date.now()-26*3600000).toISOString()}
    return {paging:{total:1},results:[{external_reference:id,live_mode:false,status:pending?'pending':'cancelled'}]}
  })
  id=(await payments.checkout(input(),user)).id
  await assert.rejects(payments.closeReservation(id),/reciente/)
  db.prepare('UPDATE checkout_attempts SET expires=?').run(Date.now()-26*3600000)
  await assert.rejects(payments.closeReservation(id),/pendientes/)
  assert.equal(db.prepare('SELECT available FROM inventory').get().available,8)
  pending=false;await payments.closeReservation(id)
  assert.equal(db.prepare('SELECT available FROM inventory').get().available,10)
  await assert.rejects(payments.closeReservation(id),/reserva abierta/)
})
test('pagination, accent-insensitive search and selected SKU hydration do not return the full catalog',t=>{
  const {db}=fixture(t,async()=>{})
  importCatalog(db,{...seed,demo:false,products:Array.from({length:60},(_,i)=>({...seed.products[0],id:`P${i}`,price:i+1,published:true}))},{replace:true})
  const page=catalogPage(db,new URLSearchParams('q=ceramica&page=2&orden=mayor'))
  assert.equal(page.total,60);assert.equal(page.products.length,24);assert.equal(page.products[0].price,36)
  assert.equal(selectedCatalog(db,['P3','P4']).products.length,2)
  assert.equal(catalogPage(db,new URLSearchParams('q=%')).total,0)
})
test('line multiplication and total cannot exceed monetary bounds',()=>{
  assert.throws(()=>validateOrder({...input(),items:[{id:'A',quantity:2}]},{products:[{...seed.products[0],price:10000000}]}),/importe/)
})
