import fs from 'fs'

const data = JSON.parse(fs.readFileSync('D:\\Anthropic Project\\phy-switch-FAE online\\data\\parsed_chunks.json', 'utf-8'))

const productGuideChunks = data.filter((chunk: any) =>
  chunk.metadata.source === 'Product Selection Guide.pdf'
)

console.log(`Found ${productGuideChunks.length} chunks from Product Selection Guide.pdf\n`)

productGuideChunks.forEach((chunk: any, idx: number) => {
  console.log(`\n=== Chunk ${idx + 1} (Page ${chunk.metadata.page}) ===`)
  console.log(chunk.content)
  console.log('='.repeat(80))
})
