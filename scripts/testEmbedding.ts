/**
 * 测试向量模型维度
 */

import dotenv from 'dotenv'
import { generateEmbedding } from '../lib/vectorStore'

// 加载环境变量
dotenv.config()

async function testEmbedding() {
  console.log('=== 测试 BAAI/bge-m3 向量模型 ===\n')

  const testText = 'YT8512是一款10/100 Mbps以太网PHY芯片'

  console.log('测试文本:', testText)
  console.log('开始生成向量...\n')

  try {
    const embedding = await generateEmbedding(testText)

    console.log('✅ 向量生成成功！')
    console.log(`向量维度: ${embedding.length}`)
    console.log(`向量前10个值: [${embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}...]`)

    if (embedding.length === 1024) {
      console.log('\n✅ 维度匹配！可以直接使用现有数据库结构')
    } else {
      console.log(`\n⚠️ 维度不匹配！数据库设置是1024维，模型输出是${embedding.length}维`)
      console.log('需要修改 supabase/init.sql 中的向量维度')
    }
  } catch (error) {
    console.error('❌ 向量生成失败:', error)
  }
}

// 执行测试
testEmbedding().catch((error) => {
  console.error('测试失败:', error)
  process.exit(1)
})
