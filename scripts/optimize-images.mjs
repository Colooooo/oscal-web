import sharp from 'sharp'
for (const width of [640,1280,1920]) {
  const info = await sharp('public/oscal-hero-background.jpg').resize({width,withoutEnlargement:true}).webp({quality:78,effort:6}).toFile(`public/oscal-hero-${width}.webp`)
  console.log(`${width}px: ${info.size} bytes`)
}
