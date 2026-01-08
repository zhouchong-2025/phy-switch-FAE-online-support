import { answerQuestion } from '../lib/rag'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config({ path: '.env' })

async function testSelectionQueries() {
  console.log('🧪 测试选型问题优化效果\n')
  console.log('=' .repeat(80))

  const testCases = [
    {
      name: '车规百兆T1 PHY选型',
      query: '车规百兆T1 PHY推荐'
    },
    {
      name: '车规千兆PHY选型',
      query: '车规千兆PHY有哪些型号'
    },
    {
      name: 'YT8522对比YT8512',
      query: 'YT8522和YT8512的区别是什么'
    },
    {
      name: '商规千兆PHY选型',
      query: '千兆商规PHY推荐'
    }
  ]

  for (const testCase of testCases) {
    console.log(`\n\n📝 测试: ${testCase.name}`)
    console.log(`问题: ${testCase.query}`)
    console.log('-'.repeat(80))

    try {
      const result = await answerQuestion(testCase.query)

      console.log('\n💬 回答:')
      console.log(result.response)

      console.log('\n📚 参考来源:')
      result.sources.forEach((source, idx) => {
        const hasSelectionGuide = /Selection.*Guide/i.test(source)
        const prefix = hasSelectionGuide ? '✅ [Selection Guide]' : '  '
        console.log(`${prefix} ${idx + 1}. ${source}`)
      })

      // 检查是否包含Selection Guide
      const hasSelectionGuide = result.sources.some(s => /Selection.*Guide/i.test(s))
      if (hasSelectionGuide) {
        console.log('\n✅ 成功检索到Selection Guide文档')
      } else {
        console.log('\n⚠️  未检索到Selection Guide文档')
      }

    } catch (error) {
      console.error('❌ 错误:', error)
    }

    console.log('='.repeat(80))
  }

  console.log('\n\n🎉 测试完成！')
}

testSelectionQueries()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 错误:', error)
    process.exit(1)
  })
