import { searchDocuments } from '../lib/vectorStore'
import { expandQueryTerms } from '../lib/rag'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config({ path: '.env' })

// 模拟术语扩展函数（从rag.ts复制）
function testExpandTerms(question: string): string {
  let expandedQuery = question

  // 百兆 -> 添加"FE"同义词
  if (/百兆/i.test(question)) {
    expandedQuery += ' FE 100M'
  }

  // 车规/车载 -> 添加英文术语
  if (/车规|车载|汽车/i.test(question)) {
    expandedQuery += ' Automotive AEC-Q100 车规 车载'
  }

  // TX -> 添加MAC接口术语（与T1区分）
  if (/\bTX\b/i.test(question) && !/\bT1\b/i.test(question)) {
    expandedQuery += ' SGMII RGMII MII MAC interface 传输接口 TX接口'
  }

  // T1 -> 添加车载以太网术语（仅当不是排除T1的情况）
  if (/\bT1\b/i.test(question) && !/不是.*T1|非T1|排除.*T1/i.test(question)) {
    expandedQuery += ' 100BASE-T1 automotive ethernet'
  }

  return expandedQuery
}

async function testTXvsT1Accuracy() {
  console.log('🧪 测试TX vs T1查询准确性\n')
  console.log('='.repeat(80))

  const testCases = [
    {
      name: 'T1查询（正确）',
      query: '车规百兆T1 PHY推荐',
      expectedKeywords: ['YT8010A', 'YT8010AN', '100BASE-T1', 'T1'],
      unexpectedKeywords: ['YT8522', 'SGMII', 'RGMII']
    },
    {
      name: 'TX查询（正确）',
      query: '车规百兆TX PHY推荐',
      expectedKeywords: ['YT8522', 'SGMII', 'RGMII'],
      unexpectedKeywords: ['YT8010A', '100BASE-T1']
    },
    {
      name: '排除T1查询',
      query: '我需要TX不是T1',
      expectedKeywords: ['SGMII', 'RGMII', 'TX'],
      unexpectedKeywords: ['100BASE-T1', 'YT8010A']
    },
    {
      name: '车规千兆TX查询',
      query: '车规千兆TX PHY有哪些',
      expectedKeywords: ['YT8531', 'RGMII', 'SGMII'],
      unexpectedKeywords: ['YT8011A', '100BASE-T1']
    }
  ]

  for (const testCase of testCases) {
    console.log(`\n\n📝 测试: ${testCase.name}`)
    console.log(`查询: "${testCase.query}"`)
    console.log('-'.repeat(80))

    // 1. 测试术语扩展
    console.log('\n📋 步骤1: 术语扩展')
    const expandedQuery = testExpandTerms(testCase.query)
    console.log(`原始查询: ${testCase.query}`)
    console.log(`扩展后: ${expandedQuery}`)

    const expansionCorrect =
      testCase.expectedKeywords.some(kw => expandedQuery.includes(kw)) &&
      !testCase.unexpectedKeywords.some(kw => expandedQuery.includes(kw))

    if (expansionCorrect) {
      console.log('✅ 术语扩展正确')
    } else {
      console.log('❌ 术语扩展错误')
      console.log(`  期望包含: ${testCase.expectedKeywords.join(', ')}`)
      console.log(`  不应包含: ${testCase.unexpectedKeywords.join(', ')}`)
    }

    // 2. 测试向量检索
    console.log('\n🔍 步骤2: 向量检索')
    try {
      const results = await searchDocuments(expandedQuery, 10)
      console.log(`找到 ${results.length} 个相关文档块\n`)

      // 显示前5个结果
      const topResults = results.slice(0, 5)
      topResults.forEach((result, idx) => {
        const hasExpected = testCase.expectedKeywords.some(kw =>
          result.source.toUpperCase().includes(kw.toUpperCase()) ||
          result.content.toUpperCase().includes(kw.toUpperCase())
        )
        const prefix = hasExpected ? '✅' : '  '
        console.log(`${prefix} ${idx + 1}. ${result.source} (${(result.similarity * 100).toFixed(1)}%)`)
      })

      // 检查是否包含正确的型号/关键词
      const hasExpectedContent = results.some(r =>
        testCase.expectedKeywords.some(kw =>
          r.source.toUpperCase().includes(kw.toUpperCase()) ||
          r.content.toUpperCase().includes(kw.toUpperCase())
        )
      )

      const hasUnexpectedContent = results.some(r =>
        testCase.unexpectedKeywords.some(kw =>
          r.source.toUpperCase().includes(kw.toUpperCase()) ||
          r.content.toUpperCase().includes(kw.toUpperCase())
        )
      )

      console.log('\n📊 检索结果分析:')
      if (hasExpectedContent) {
        console.log(`✅ 找到期望内容: ${testCase.expectedKeywords.join(', ')}`)
      } else {
        console.log(`⚠️  未找到期望内容: ${testCase.expectedKeywords.join(', ')}`)
      }

      if (hasUnexpectedContent) {
        console.log(`⚠️  包含不期望内容: ${testCase.unexpectedKeywords.join(', ')}`)
      } else {
        console.log(`✅ 未包含不期望内容`)
      }

      const overallCorrect = hasExpectedContent && !hasUnexpectedContent
      console.log(`\n${overallCorrect ? '✅' : '❌'} 总体评估: ${overallCorrect ? '准确' : '需要改进'}`)

    } catch (error) {
      console.error('❌ 检索错误:', error)
    }

    console.log('='.repeat(80))
  }

  console.log('\n\n🎉 测试完成！')
}

testTXvsT1Accuracy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 错误:', error)
    process.exit(1)
  })
