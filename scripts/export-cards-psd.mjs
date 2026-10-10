import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'
const require = createRequire('C:/Users/Juan/.codex/tmp/oscal-psd-deps/package.json')
const { writePsdBuffer, readPsd, initializeCanvas } = require('ag-psd')
const { createCanvas, ImageData, loadImage } = require('@napi-rs/canvas')
initializeCanvas(createCanvas, (w,h) => new ImageData(w,h))
const input = new URL('../output/tarjetas-oscal/', import.meta.url)
const output = new URL('../output/tarjetas-oscal-photoshop/', import.meta.url)
await mkdir(output, {recursive:true})
const cards = JSON.parse(await readFile(new URL('layers.json',input),'utf8'))
const W=2160,H=1200
const fonts=['arial.ttf','arialbd.ttf','georgia.ttf'].map(n=>`C:/Windows/Fonts/${n}`)
const hex = s => ({r:parseInt(s.slice(1,3),16),g:parseInt(s.slice(3,5),16),b:parseInt(s.slice(5,7),16)})
async function render(fragment) {
  const source=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="600" viewBox="0 0 1080 600">${fragment}</svg>`
  const png = new Resvg(source,{fitTo:{mode:'width',value:W},font:{fontFiles:fonts,loadSystemFonts:false,defaultFontFamily:'Arial'}}).render().asPng()
  const canvas=createCanvas(W,H),ctx=canvas.getContext('2d')
  ctx.drawImage(await loadImage(png),0,0)
  const data=ctx.getImageData(0,0,W,H).data
  let l=W,t=H,r=0,b=0
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(data[(y*W+x)*4+3]){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x+1);b=Math.max(b,y+1)}
  if(r<=l||b<=t)return null
  return {left:l,top:t,right:r,bottom:b,imageData:ctx.getImageData(l,t,r-l,b-t)}
}
const report=[]
for(const [name,nodes] of Object.entries(cards)) {
  const layers=[]
  for(let i=0;i<nodes.length;i++) {
    const node=nodes[i],a=node.attrs
    let fragment=node.svg, label
    if(node.tag==='text')label=`Texto · ${node.content}`
    else if(node.tag==='g')label='Logo Oscal'
    else if(node.tag==='rect' && a.fill==='#fff' && nodes[i+1]?.tag==='path') {
      fragment+=nodes[++i].svg; label='QR · oscal-pink.vercel.app'
    } else if(node.tag==='rect') label= i===0 ? 'Fondo' : `Forma ${i} · ${a.fill}`
    else label=`Decoración ${i}`
    const layer=await render(fragment)
    if(!layer)continue
    layer.name=label
    if(node.tag==='text') {
      const size=+a['font-size'],font=a['font-family']==='Georgia'?'Georgia':a['font-weight']==='bold'?'Arial-BoldMT':'ArialMT'
      layer.text={text:node.content,transform:[2,0,0,2,+a.x*2,+a.y*2],shapeType:'point',pointBase:[0,0],antiAlias:'smooth',
        style:{font:{name:font},fontSize:size,fillColor:hex(a.fill),tracking:Math.round((+(a['letter-spacing']||0))/size*1000)},
        paragraphStyle:{justification:a['text-anchor']==='middle'?'center':a['text-anchor']==='end'?'right':'left'}}
    }
    layers.push(layer)
  }
  const merged=createCanvas(W,H),ctx=merged.getContext('2d')
  ctx.drawImage(await loadImage(await readFile(new URL(`${name}.png`,input))),0,0)
  const ppi=W/(90/25.4)
  const psd={width:W,height:H,imageData:ctx.getImageData(0,0,W,H),children:layers,imageResources:{resolutionInfo:{horizontalResolution:ppi,verticalResolution:ppi,horizontalResolutionUnit:'PPI',verticalResolutionUnit:'PPI',widthUnit:'Centimeters',heightUnit:'Centimeters'}}}
  const data=writePsdBuffer(psd)
  await writeFile(new URL(`${name}.psd`,output),data)
  const check=readPsd(data,{useImageData:true})
  if(check.children.length!==layers.length)throw Error('Layer count mismatch')
  const expected=nodes.filter(n=>n.tag==='text').map(n=>n.content)
  const actual=check.children.filter(l=>l.text).map(l=>l.text.text)
  if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('Editable text mismatch')
  const restored=createCanvas(W,H)
  restored.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(check.imageData.data),W,H),0,0)
  await writeFile(new URL(`${name}-verificado.png`,output),restored.toBuffer('image/png'))
  report.push({file:`${name}.psd`,layers:layers.length,editableTexts:actual.length,width:check.width,height:check.height})
  await copyFile(new URL(`${name}.svg`,input),new URL(`${name}-vector.svg`,output))
}
await writeFile(new URL('LEEME.txt',output),'OSCAL — 4 tarjetas preliminares para Photoshop\r\n\r\nAbrí el PSD de la propuesta elegida.\r\nTextos: capas de texto editables, con Arial y Georgia.\r\nLogo, QR, fondos y decoraciones: capas de imagen separadas.\r\nSVG adjuntos: originales vectoriales, para colocar como objetos inteligentes si lo necesitás.\r\nTamaño: 2160 × 1200 px, equivalente a 90 × 50 mm a 609,6 ppp. Color RGB.\r\nQR: https://oscal-pink.vercel.app/\r\nSi Photoshop pide actualizar capas de texto al abrir, aceptá la actualización.\r\nSon propuestas preliminares sin sangrado.\r\n','utf8')
await writeFile(new URL('verificacion.json',output),JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
