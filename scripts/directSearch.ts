/**
 * 直接搜索YT8512
 */

import dotenv from 'dotenv'
import { searchDocuments } from '../lib/vectorStore'

dotenv.config()

async function directSearch() {
  console.log('=== 直接搜索 YT8512 ===\n')

  const queries = [
    'YT8512',
    'YT8522',
    'YT8512 YT8522对比',
    'YT8512和YT8522的区别',
  ]

  for (const query of queries) {
    console.log(`查询: "${query}"`)
    const results = await searchDocuments(query, 10)
    console.log(`找到 ${results.length} 个结果\n`)

    // 统计来源分布
    const sources: Record<string, number> = {}
    results.forEach(r => {
      const fileName = r.source.split('.')[0]
      sources[fileName] = (sources[fileName] || 0) + 1
    })

    console.log('来源分布:')
    Object.entries(sources).forEach(([file, count]) => {
      console.log(`  ${file}: ${count}个`)
    })
    console.log()
  }
}

directSearch()
