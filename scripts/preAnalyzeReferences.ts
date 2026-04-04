/**
 * 缓存预热脚本：预先分析所有参考设计并缓存结果
 *
 * 使用方法：
 * ```bash
 * npx tsx scripts/preAnalyzeReferences.ts
 * ```
 *
 * 功能：
 * - 遍历 Database 文件夹中的所有参考设计 PDF
 * - 使用 LLM 分析并提取设计信息
 * - 将分析结果保存到 cache 文件夹
 * - 避免首次使用时的长时间等待（90秒 -> 0秒）
 */

import 'dotenv/config'
import { promises as fs } from 'fs'
import path from 'path'
import { extractPDFText, analyzeReferenceText } from '../lib/schematicAnalyzer'

const CACHE_DIR = path.join(process.cwd(), 'cache')
const DATABASE_DIR = path.join(process.cwd(), 'Database')

// 参考设计文件映射（仅保留当前支持的芯片型号）
const REFERENCE_FILES = [
  { chipModel: 'YT8522', fileName: 'YT8522_REF_Schematic.pdf' },
  { chipModel: 'YT8512', fileName: 'YT8512_reference_design.pdf' },
]

async function main() {
  console.log('🚀 开始预热参考设计缓存...\n')

  // 确保缓存目录存在（异步）
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
    console.log(`✓ 缓存目录已准备: ${CACHE_DIR}\n`)
  } catch (error) {
    console.error('❌ 创建缓存目录失败:', error)
    process.exit(1)
  }

  let successCount = 0
  let failCount = 0

  for (const { chipModel, fileName } of REFERENCE_FILES) {
    const cachePath = path.join(CACHE_DIR, `${chipModel}_ref_analysis.json`)
    const pdfPath = path.join(DATABASE_DIR, fileName)

    console.log(`📄 处理 ${chipModel} (${fileName})...`)

    // 检查缓存是否已存在（异步）
    try {
      await fs.access(cachePath)
      const cached = JSON.parse(await fs.readFile(cachePath, 'utf-8'))
      console.log(`  ⚡ 缓存已存在 (生成时间: ${cached.cachedAt})`)
      console.log(`  ℹ️  如需重新生成，请删除: ${cachePath}\n`)
      successCount++
      continue
    } catch {
      // 缓存不存在，继续分析
    }

    // 检查 PDF 是否存在（异步）
    try {
      await fs.access(pdfPath)
    } catch {
      console.error(`  ❌ PDF 文件不存在: ${pdfPath}\n`)
      failCount++
      continue
    }

    try {
      // 读取 PDF（异步）
      console.log(`  📖 读取 PDF...`)
      const buffer = await fs.readFile(pdfPath)

      // 提取文本
      console.log(`  🔍 提取文本...`)
      const text = await extractPDFText(buffer.buffer)
      console.log(`  ✓ 提取文本长度: ${text.length} 字符`)

      // LLM 分析
      console.log(`  🤖 LLM 分析中（需90秒左右）...`)
      const startTime = Date.now()
      const result = await analyzeReferenceText(text)

      if (!result.success) {
        throw new Error(result.error || '分析失败')
      }

      const duration = Date.now() - startTime
      console.log(`  ✓ 分析完成，耗时 ${(duration / 1000).toFixed(1)} 秒`)

      // 保存缓存（异步）
      const cacheData = {
        chipModel,
        analysis: result.analysis,
        method: result.method,
        duration: result.duration,
        cachedAt: new Date().toISOString(),
      }

      await fs.writeFile(
        cachePath,
        JSON.stringify(cacheData, null, 2),
        'utf-8'
      )
      console.log(`  💾 缓存已保存: ${cachePath}`)
      console.log(`  ✅ ${chipModel} 完成！\n`)
      successCount++
    } catch (error: any) {
      console.error(`  ❌ 处理失败:`, error.message, '\n')
      failCount++
    }
  }

  // 汇总统计
  console.log('='.repeat(60))
  console.log('📊 预热完成统计:')
  console.log(`  ✅ 成功: ${successCount} 个`)
  console.log(`  ❌ 失败: ${failCount} 个`)
  console.log(`  📁 缓存目录: ${CACHE_DIR}`)
  console.log('='.repeat(60))

  if (failCount > 0) {
    console.log('\n⚠️  部分文件处理失败，请检查错误信息')
    process.exit(1)
  } else {
    console.log('\n🎉 所有参考设计缓存已预热完成！')
    process.exit(0)
  }
}

main().catch((error) => {
  console.error('\n❌ 脚本执行失败:', error)
  process.exit(1)
})
