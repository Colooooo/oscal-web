import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'

const out = new URL('../output/tarjetas-oscal/', import.meta.url)
await mkdir(out, { recursive: true })
const matrix = JSON.parse(await readFile(new URL('qr-matrix.json', out), 'utf8'))
const original = await readFile(new URL('../public/oscal-logo.svg', import.meta.url), 'utf8')
const logoBody = original.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
const navy = '#292d4b', cream = '#f5f4e9', red = '#ed4c55'
const rect = (x,y,w,h,fill,rx=0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`
const text = (x,y,s,size=24,fill=navy,extra='') => `<text x="${x}" y="${y}" ${extra.includes('font-family=') ? '' : 'font-family="Arial"'} font-size="${size}" fill="${fill}" ${extra}>${s}</text>`
const logo = (x,y,w) => `<g transform="translate(${x} ${y}) scale(${w/581})">${logoBody}</g>`
function qr(x,y,size=222) {
  const u = size/matrix.length
  let p=''
  matrix.forEach((row, r) => row.forEach((v,c) => { if(v) p+=`M${c} ${r}h1v1h-1z` }))
  return `${rect(x,y,size,size,'#fff')}<path transform="translate(${x} ${y}) scale(${u})" fill="#111827" d="${p}"/>`
}
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="90mm" height="50mm" viewBox="0 0 1080 600">${body}</svg>`
const rubros = 'Juguetería · Bazar · Escolares · Cotillón'
const names=['01-clasica','02-editorial','03-colorida','04-minimalista']
const cards = [
  rect(0,0,1080,600,navy)+rect(0,576,1080,24,red)+logo(62,58,486)+text(67,345,'Pequeños objetos.',35,cream,'font-family="Georgia"')+text(67,390,'Grandes posibilidades.',35,cream)+text(67,448,rubros,22,cream)+text(67,513,'Arenal Grande 2178 · Montevideo',22,cream)+rect(695,54,325,490,cream,8)+qr(746,99,222)+text(857,367,'CONOCÉ OSCAL',19,navy,'text-anchor="middle" letter-spacing="2" font-weight="bold"')+text(857,403,'Escaneá y visitanos',23,navy,'text-anchor="middle"')+text(857,479,'oscal-pink.vercel.app',17,navy,'text-anchor="middle"'),
  rect(0,0,1080,600,cream)+rect(0,0,18,600,red)+rect(60,42,300,150,navy,6)+logo(80,51,260)+text(60,257,'Todo empieza',57,navy,'font-weight="bold"')+text(60,321,'con una idea.',57,navy,'font-weight="bold"')+rect(60,356,66,7,red)+text(60,413,'Juguetería · Bazar',26)+text(60,451,'Escolares · Cotillón',26)+text(60,522,'Arenal Grande 2178 · Montevideo',21)+rect(700,62,1,469,'#d4d4cf')+text(865,107,'DESCUBRÍ MÁS',19,navy,'text-anchor="middle" letter-spacing="2" font-weight="bold"')+qr(754,152,222)+text(865,421,'Escaneá el QR',24,navy,'text-anchor="middle"')+text(865,504,'oscal-pink.vercel.app',17,navy,'text-anchor="middle"'),
  rect(0,0,1080,600,navy)+rect(0,0,710,600,'#eee9de')+rect(0,0,355,300,'#edd5d7')+rect(355,0,355,300,'#f2d991')+rect(0,300,355,300,'#bdd3e0')+rect(355,300,355,300,'#c5d5ba')+text(34,54,'JUGUETERÍA',18,navy,'letter-spacing="2" font-weight="bold"')+text(676,54,'BAZAR',18,navy,'text-anchor="end" letter-spacing="2" font-weight="bold"')+text(34,558,'ESCOLARES',18,navy,'letter-spacing="2" font-weight="bold"')+text(676,558,'COTILLÓN',18,navy,'text-anchor="end" letter-spacing="2" font-weight="bold"')+'<circle cx="96" cy="151" r="33" fill="none" stroke="#ed4c55" stroke-width="8"/><path d="M560 145h73m-36-36v73" stroke="#a88738" stroke-width="9"/><path d="M91 400l35 35-35 35-35-35z" fill="none" stroke="#6a91af" stroke-width="8"/><path d="M574 405l48 62h-96z" fill="none" stroke="#7d986d" stroke-width="8"/>'+rect(116,197,478,210,navy,10)+logo(147,204,415)+text(890,69,'UN MUNDO',22,cream,'text-anchor="middle" letter-spacing="2"')+text(890,104,'POR DESCUBRIR',22,cream,'text-anchor="middle" letter-spacing="2"')+qr(779,155,222)+text(890,422,'Entrá a nuestra web',23,cream,'text-anchor="middle"')+text(890,457,'oscal-pink.vercel.app',18,cream,'text-anchor="middle"')+text(890,530,'Montevideo, Uruguay',18,cream,'text-anchor="middle"'),
  rect(0,0,1080,600,navy)+rect(0,0,1080,13,red)+logo(65,66,345)+text(68,309,'Lo que buscás',53,cream,'font-weight="bold"')+text(68,368,'está en Oscal.',53,cream,'font-weight="bold"')+text(68,443,rubros,21,cream)+text(68,514,'Arenal Grande 2178',24,cream)+text(68,546,'Montevideo, Uruguay',19,'#c9cad4')+qr(774,68,234)+text(891,340,'ESCANEÁ Y EXPLORÁ',16,cream,'text-anchor="middle" letter-spacing="1.5" font-weight="bold"')+text(748,447,'WHATSAPP',16,'#c9cad4','letter-spacing="2"')+text(748,486,'094 471 227',29,cream)+text(748,540,'oscal-pink.vercel.app',19,cream)
]
const fontFiles=['arial.ttf','arialbd.ttf','georgia.ttf'].map(f=>`C:/Windows/Fonts/${f}`)
async function render(source,width,path) {
  const renderer = new Resvg(source,{fitTo:{mode:'width',value:width},font:{fontFiles,loadSystemFonts:false,defaultFontFamily:'Arial'}})
  await writeFile(new URL(path,out),renderer.render().asPng())
}
for(let i=0;i<4;i++) {
  const source=svg(cards[i])
  await writeFile(new URL(`${names[i]}.svg`,out),source)
  await render(source,2160,`${names[i]}.png`)
}
const labels=['01 / CLÁSICA','02 / EDITORIAL','03 / COLORIDA','04 / MINIMALISTA']
let board=rect(0,0,2400,1660,'#e8e6e1')+text(95,100,'OSCAL / Cuatro formas de presentarnos',46,navy,'font-weight="bold"')+text(95,145,'Propuestas preliminares · Tarjetas de 90 × 50 mm · QR al sitio web',23)
for(let i=0;i<4;i++) {
  const x=95+(i%2)*1150,y=230+Math.floor(i/2)*720
  board+=text(x,y-22,labels[i],23,navy,'letter-spacing="2" font-weight="bold"')+`<g transform="translate(${x} ${y})">${cards[i]}</g>`
}
board+=text(95,1610,'Destino del QR: https://oscal-pink.vercel.app/',22)
await render(`<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1660" viewBox="0 0 2400 1660">${board}</svg>`,2400,'cuatro-propuestas.png')
await writeFile(new URL('index.html',out),`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Oscal · Tarjetas preliminares</title><style>body{margin:0;background:#e8e6e1;color:#292d4b;font:16px Arial}main{max-width:1250px;margin:auto;padding:40px 24px}h1{font-size:32px}section{display:grid;grid-template-columns:1fr 1fr;gap:36px}img{width:100%;box-shadow:0 8px 24px #292d4b18}a{color:inherit}p{line-height:1.6}@media(max-width:700px){section{grid-template-columns:1fr}}@media print{main{padding:0}article{break-inside:avoid}a{display:none}}</style><main><h1>Oscal / Cuatro formas de presentarnos</h1><p>Tarjetas preliminares de 90 × 50 mm. QR hacia <a href="https://oscal-pink.vercel.app/">oscal-pink.vercel.app</a>.</p><section>${names.map((n,i)=>`<article><h2>${labels[i]}</h2><img src="${n}.png" alt="Tarjeta ${labels[i]}"><p><a download href="${n}.png">Descargar PNG</a> · <a download href="${n}.svg">Descargar SVG editable</a></p></article>`).join('')}</section><p>Propuestas para elegir una dirección visual. Los SVG conservan el logo vectorial y el QR. Antes de imprimir, definir el diseño final y agregar el sangrado solicitado por la imprenta.</p></main></html>`)
console.log('Created 4 PNGs, 4 SVGs, comparison board and HTML gallery.')
