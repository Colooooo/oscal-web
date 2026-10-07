import { readFile, writeFile } from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'

// All exports come from the hand-drawn vector master, never from a raster trace.
const master = new URL('../public/oscal-logo.svg', import.meta.url)
const svg = await readFile(master, 'utf8')
for (const [name, width, background] of [
  ['oscal-logo-preview.png', 1162, '#292d4b'],
  ['oscal-logo-6000.png', 6000, undefined],
  ['oscal-logo-6000-azul.png', 6000, '#292d4b'],
]) {
  const renderer = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    ...(background ? { background } : {}),
  })
  await writeFile(new URL(`../public/${name}`, import.meta.url), renderer.render().asPng())
  console.log(`Exported ${name}`)
}
