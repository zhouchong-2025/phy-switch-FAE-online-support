import { createClient } from '@supabase/supabase-js'
import { parsePDF } from '../lib/pdfParser'
import { batchStoreDocuments } from '../lib/vectorStore'
import * as path from 'path'
import * as dotenv from 'dotenv'

// 加载环境变量
dotenv.config({ path: '.env' })

async function reimportSelectionGuides() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('📊 开始重新导入Selection Guide文档...\n')

  // Selection Guide文件列表
  const selectionGuideFiles = [
    'Auto Product _ Phy Selection Guide.pdf',
    'Auto Product_Switch Selection Guide.pdf',
    'Product Selection Guide.pdf'
  ]

  // 1. 删除旧的Selection Guide数据
  console.log('🗑️  删除旧的Selection Guide数据...')
  for (const fileName of selectionGuideFiles) {
    const { data, error } = await supabase
      .from('documents')
      .delete()
      .ilike('metadata->>source', fileName)

    if (error) {
      console.error(`  删除 ${fileName} 失败:`, error)
    } else {
      console.log(`  ✅ 已删除 ${fileName} 的旧数据`)
    }
  }

  console.log('\n📄 使用新的分块策略重新解析PDF...\n')

  // 2. 重新解析并导入
  const databasePath = path.join(process.cwd(), 'Database')
  const allChunks: any[] = []

  for (const fileName of selectionGuideFiles) {
    const filePath = path.join(databasePath, fileName)
    try {
      console.log(`正在解析: ${fileName}`)
      const chunks = await parsePDF(filePath)
      console.log(`  生成 ${chunks.length} 个文档块 (优化后)\n`)
      allChunks.push(...chunks)
    } catch (error) {
      console.error(`解析 ${fileName} 失败:`, error)
    }
  }

  console.log(`\n📊 总计生成 ${allChunks.length} 个文档块（优化后）`)
  console.log(`对比: 优化前仅5个块 → 优化后${allChunks.length}个块\n`)

  // 3. 批量存储到数据库
  console.log('💾 开始批量存储到Supabase...\n')
  await batchStoreDocuments(allChunks)

  console.log('\n✅ Selection Guide文档重新导入完成！')

  // 4. 验证导入结果
  console.log('\n📊 验证导入结果...\n')
  for (const fileName of selectionGuideFiles) {
    const { data, error } = await supabase
      .from('documents')
      .select('id')
      .ilike('metadata->>source', fileName)

    if (error) {
      console.error(`  查询 ${fileName} 失败:`, error)
    } else {
      console.log(`  ✅ ${fileName}: ${data?.length || 0} 个文档块`)
    }
  }
}

reimportSelectionGuides()
  .then(() => {
    console.log('\n🎉 全部完成！')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 错误:', error)
    process.exit(1)
  })
