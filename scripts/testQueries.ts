/**
 * 测试不同查询词的效果
 */

import dotenv from 'dotenv'
import { searchDocuments } from '../lib/vectorStore'

dotenv.config()

async function testDifferentQueries() {
  console.log('=== 测试不同查询词 ===\n')

  const queries = [
    'YT8512工作电压',
    'YT8512 supply voltage',
    'YT8512电源要求',
    'YT8512 power supply',
    'YT8512的DVDD33电压',
  ]

  for (const query of queries) {
    console.log(`查询: "${query}"`)
    const results = await searchDocuments(query, 3)
    console.log(`结果: ${results.length}个`)
    if (results.length > 0) {
      console.log(`  最佳匹配: ${results[0].source} (${(results[0].similarity * 100).toFixed(1)}%)`)
      console.log(`  内容: ${results[0].content.substring(0, 100)}...`)
    }
    console.log()
  }
}

testDifferentQueries()
