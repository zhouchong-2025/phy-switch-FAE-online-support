/**
 * 预分析所有参考设计并缓存结果
 * 运行: npx tsx scripts/preAnalyzeReferences.ts
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { extractPDFText, analyzeReferenceText } from '../lib/schematicAnalyzer'

const CACHE_DIR = path.join(process.cwd(), 'cache')
const DATABASE_DIR = path.join(process.cwd(), 'Database')

// 确保缓存目录存在
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
}

async function preAnalyzeReference(chipModel: string) {
  // 尝试多种文件名格式
  const possibleFiles = [
    `${chipModel}_REF_Schematic.pdf`,
    `${chipModel}_reference_design.pdf`,
    `${chipModel}_ref_schematic.pdf`,
  ]

  let pdfPath: string | null = null
  for (const fileName of possibleFiles) {
    const testPath = path.join(DATABASE_DIR, fileName)
    if (fs.existsSync(testPath)) {
      pdfPath = testPath
      break
    }
  }

  const cachePath = path.join(CACHE_DIR, `${chipModel}_ref_analysis.json`)

  if (!pdfPath) {
    console.log(`❌ 未找到参考设���: ${chipModel}`)
    return
  }

  console.log(`\n📄 分析 ${chipModel} 参考设计 (${path.basename(pdfPath)})...`)

  const refBuffer = fs.readFileSync(pdfPath)
  const refText = await extractPDFText(refBuffer.buffer)
  console.log(`  ✓ PDF 文本提取完成，长度: ${refText.length} 字符`)

  const result = await analyzeReferenceText(refText)

  if (!result.success) {
    console.log(`  ❌ 分析失败: ${result.error}`)
    return
  }

  console.log(`  ✓ 分析完成，耗时: ${((result.duration || 0) / 1000).toFixed(1)} 秒`)

  // 保存到缓存
  fs.writeFileSync(
    cachePath,
    JSON.stringify(
      {
        chipModel,
        analysis: result.analysis,
        method: result.method,
        duration: result.duration,
        cachedAt: new Date().toISOString(),
      },
      null,
      2
    )
  )

  console.log(`  ✓ 缓存已保存: ${cachePath}`)
}

async function main() {
  console.log('🚀 开始预分析参考设计...\n')

  const chipModels = ['YT8522', 'YT8521', 'YT8531', 'YT8512']

  for (const model of chipModels) {
    await preAnalyzeReference(model)
  }

  console.log('\n✅ 所有参考设计分析完成！')
}

main().catch(console.error)
