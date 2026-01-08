import { searchDocuments } from '../lib/vectorStore'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config({ path: '.env' })

async function testVectorSearch() {
  console.log('🧪 测试向量搜索 - Selection Guide检索效果\n')
  console.log('=' .repeat(80))

  const testQueries = [
    '车规百兆T1 PHY推荐',
    '车规千兆PHY有哪些',
    'Automotive 100BASE-T1 PHY',
    '千兆商规PHY选型'
  ]

  for (const query of testQueries) {
    console.log(`\n📝 查询: "${query}"`)
    console.log('-'.repeat(80))

    try {
      const results = await searchDocuments(query, 10)

      console.log(`找到 ${results.length} 个相关文档块:\n`)

      results.forEach((result, idx) => {
        const hasSelectionGuide = /Selection.*Guide/i.test(result.source)
        const prefix = hasSelectionGuide ? '✅' : '  '
        console.log(`${prefix} ${idx + 1}. ${result.source} (第${result.page}页) - 相似度: ${(result.similarity * 100).toFixed(1)}%`)

        if (hasSelectionGuide) {
          // 显示部分内容
          const preview = result.content.substring(0, 150).replace(/\s+/g, ' ')
          console.log(`     预览: ${preview}...`)
        }
      })

      const selectionGuideCount = results.filter(r => /Selection.*Guide/i.test(r.source)).length
      console.log(`\n📊 Selection Guide文档: ${selectionGuideCount}/${results.length}`)

      if (selectionGuideCount > 0) {
        console.log('✅ 成功检索到Selection Guide')
      } else {
        console.log('⚠️  未检索到Selection Guide')
      }

    } catch (error) {
      console.error('❌ 错误:', error)
    }

    console.log('='.repeat(80))
  }

  console.log('\n\n🎉 测试完成！')
}

testVectorSearch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 错误:', error)
    process.exit(1)
  })
