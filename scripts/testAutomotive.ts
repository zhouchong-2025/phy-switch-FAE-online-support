import dotenv from 'dotenv'
import { searchDocuments } from '../lib/vectorStore'

dotenv.config()

async function testAutomotive() {
  console.log('=== 测试车规相关查询 ===\n')

  const queries = [
    '车规',
    'automotive',
    'YT8522 车规',
    'YT8522 automotive',
    '8522有车规的吗',
    'YT8512 YT8522 车规',
  ]

  for (const query of queries) {
    console.log(`\n查询: "${query}"`)
    const results = await searchDocuments(query, 5)
    console.log(`找到 ${results.length} 个结果`)

    results.forEach((r, idx) => {
      console.log(`\n[${idx + 1}] ${r.source} (${(r.similarity * 100).toFixed(1)}%)`)
      console.log(`  内容预览: ${r.content.substring(0, 150)}...`)
    })
    console.log('\n' + '='.repeat(80))
  }
}

testAutomotive()
