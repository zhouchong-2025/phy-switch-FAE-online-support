/**
 * 测试向量搜索功能
 */

import dotenv from 'dotenv'
import { searchDocuments } from '../lib/vectorStore'

// 加载环境变量
dotenv.config()

async function testVectorSearch() {
  console.log('=== 开始测试向量搜索 ===\n')

  const testQueries = [
    'YT8512支持哪些接口？',
    'YT8522和YT8512的区别',
    'PHY芯片的调试方法',
    'YT8512工作电压',
  ]

  for (const query of testQueries) {
    console.log(`\n测试问题: "${query}"`)
    console.log('─'.repeat(50))

    try {
      const results = await searchDocuments(query, 5)

      console.log(`找到 ${results.length} 个相关文档\n`)

      results.forEach((result, idx) => {
        console.log(`[${idx + 1}] ${result.source} (第${result.page}页)`)
        console.log(`    相似度: ${(result.similarity * 100).toFixed(2)}%`)
        console.log(`    内容预览: ${result.content.substring(0, 100)}...`)
        console.log()
      })
    } catch (error) {
      console.error('搜索失败:', error)
    }
  }

  console.log('\n=== 测试完成 ===')
}

// 执行测试
testVectorSearch().catch((error) => {
  console.error('测试失败:', error)
  process.exit(1)
})
