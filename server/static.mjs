import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { promisify } from 'node:util'
import { brotliCompress, gzip } from 'node:zlib'
const br = promisify(brotliCompress), gz = promisify(gzip)
const types = { '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.webp':'image/webp', '.avif':'image/avif', '.png':'image/png', '.woff2':'font/woff2', '.json':'application/json', '.html':'text/html' }
export function staticHandler(directory) {
  const root = resolve(directory), cache = new Map()
  let cacheBytes = 0
  return async (req,res,url) => {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return }
    let file = resolve(root,'.'+decodeURIComponent(url.pathname))
    if (file !== root && !file.startsWith(root+sep)) { res.writeHead(403); res.end(); return }
    let info
    try { info = await stat(file); if (!info.isFile()) throw new Error() } catch {
      if (extname(url.pathname) || url.pathname.startsWith('/assets/')) { res.writeHead(404); res.end(); return }
      file = resolve(root,'index.html'); info = await stat(file)
    }
    let entry = cache.get(file)
    if (!entry || entry.modified !== info.mtimeMs) {
      const data = await readFile(file)
      const compressible = /\.(js|css|svg|json|html)$/.test(file)
      entry = { data, modified: info.mtimeMs, etag: `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`, br: compressible ? await br(data) : null, gzip: compressible ? await gz(data) : null }
      const bytes = data.length + (entry.br?.length || 0) + (entry.gzip?.length || 0)
      if (cacheBytes + bytes > 16 * 1024 * 1024) { cache.clear(); cacheBytes = 0 }
      if (bytes <= 16 * 1024 * 1024) { cache.set(file,entry); cacheBytes += bytes }
    }
    const accepted=(req.headers['accept-encoding'] || '').split(',').map(part=>{const [name,...params]=part.trim().split(';');const q=params.find(p=>p.trim().startsWith('q='));return {name,q:q?Number(q.trim().slice(2)):1}}).filter(p=>p.q>0).sort((a,b)=>b.q-a.q || (a.name==='br'?-1:b.name==='br'?1:0))
    const chosen=accepted.find(p=>['br','gzip'].includes(p.name) && entry[p.name])?.name || null
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream')
    res.setHeader('Cache-Control', /[\\/]assets[\\/].+-[\w-]+\./.test(file) ? 'public, max-age=31536000, immutable' : extname(file)==='.html' ? 'no-cache' : 'public, max-age=3600, must-revalidate')
    res.setHeader('ETag',entry.etag); res.setHeader('Vary','Accept-Encoding')
    if (chosen) res.setHeader('Content-Encoding',chosen)
    if (req.headers['if-none-match']===entry.etag) { res.writeHead(304); res.end(); return }
    const content = chosen ? entry[chosen] : entry.data
    res.setHeader('Content-Length',content.length); res.writeHead(200); res.end(req.method==='HEAD' ? undefined : content)
  }
}
