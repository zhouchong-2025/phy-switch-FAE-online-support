import dotenv from 'dotenv'
import { searchDocuments } from '../lib/vectorStore'

dotenv.config()

async function testAECQuery() {
  console.log('=== 测试AEC-Q100相关查询 ===\n')

  const queries = [
    'YT8522 AEC-Q100',
    'YT8522A',
    'YT8522 automotive application',
    'YT8522 grade 2',
    'YT8522 工业级特殊场景',
  ]

  for (const query of queries) {
    console.log(`\n查询: "${query}"`)
    const results = await searchDocuments(query, 5)
    console.log(`找到 ${results.length} 个结果`)

    // 查找Product Selection Guide
    const productGuide = results.find(r => r.source === 'Product Selection Guide.pdf')
    if (productGuide) {
      console.log(`✅ 找到Product Selection Guide! (${(productGuide.similarity * 100).toFixed(1)}%)`)
      console.log(`   内容: ${productGuide.content.substring(0, 200)}...`)
    } else {
      console.log(`❌ 没有找到Product Selection Guide`)
      console.log(`   前3个来源:`, results.slice(0, 3).map(r => r.source))
    }
  }
}

testAECQuery()
