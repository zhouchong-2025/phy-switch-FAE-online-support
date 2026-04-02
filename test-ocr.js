/**
 * OCR功能测试脚本
 * 使用方法：
 * 1. 测试单页OCR：node test-ocr.js single <pdf路径> [页码]
 * 2. 测试完整PDF OCR：node test-ocr.js full <pdf路径>
 * 3. 测试混合模式（优先文本提取，失败时OCR）：node test-ocr.js hybrid <pdf路径>
 */

import { testOCRSinglePage, parsePDFWithOCR } from './lib/ocrParser.ts'
import path from 'path'

const args = process.argv.slice(2)
const mode = args[0]
const pdfPath = args[1]
const pageNum = args[2] ? parseInt(args[2]) : 1

if (!mode || !pdfPath) {
  console.log('使用方法:')
  console.log('  node test-ocr.js single <pdf路径> [页码]     # 测试单页OCR')
  console.log('  node test-ocr.js full <pdf路径>              # 测试完整PDF OCR')
  console.log('  node test-ocr.js hybrid <pdf路径>            # 混合模式（优先文本提取）')
  process.exit(1)
}

async function main() {
  try {
    console.log('='.repeat(60))
    console.log('PaddleOCR-VL-1.5 测试工具')
    console.log('='.repeat(60))

    const fullPath = path.resolve(pdfPath)
    console.log(`PDF路径: ${fullPath}`)
    console.log(`模式: ${mode}`)
    console.log('='.repeat(60))

    if (mode === 'single') {
      // 测试单页OCR
      console.log(`\n开始测试第 ${pageNum} 页OCR识别...\n`)
      const result = await testOCRSinglePage(fullPath, pageNum)
      console.log('\n' + '='.repeat(60))
      console.log('识别完成！')
      console.log('='.repeat(60))
    } else if (mode === 'full') {
      // 测试完整PDF OCR（强制所有页面OCR）
      console.log('\n开始测试完整PDF OCR识别（强制OCR所有页面）...\n')
      const startTime = Date.now()
      const chunks = await parsePDFWithOCR(fullPath, true)
      const endTime = Date.now()

      console.log('\n' + '='.repeat(60))
      console.log('识别完成！')
      console.log(`总耗时: ${((endTime - startTime) / 1000).toFixed(2)} 秒`)
      console.log(`生成文档块: ${chunks.length} 个`)
      console.log('='.repeat(60))

      // 显示前3个块的内容示例
      console.log('\n前3个文档块示例:')
      chunks.slice(0, 3).forEach((chunk, index) => {
        console.log(`\n--- 块 ${index + 1} ---`)
        console.log(`来源: ${chunk.metadata.source}`)
        console.log(`页码: ${chunk.metadata.page}`)
        console.log(`内容预览: ${chunk.content.substring(0, 200)}...`)
      })
    } else if (mode === 'hybrid') {
      // 混合模式：优先文本提取，失败时OCR
      console.log('\n开始测试混合模式识别（优先文本提取，必要时OCR）...\n')
      const startTime = Date.now()
      const chunks = await parsePDFWithOCR(fullPath, false)
      const endTime = Date.now()

      console.log('\n' + '='.repeat(60))
      console.log('识别完成！')
      console.log(`总耗时: ${((endTime - startTime) / 1000).toFixed(2)} 秒`)
      console.log(`生成文档块: ${chunks.length} 个`)
      console.log('='.repeat(60))

      // 显示前3个块的内容示例
      console.log('\n前3个文档块示例:')
      chunks.slice(0, 3).forEach((chunk, index) => {
        console.log(`\n--- 块 ${index + 1} ---`)
        console.log(`来源: ${chunk.metadata.source}`)
        console.log(`页码: ${chunk.metadata.page}`)
        console.log(`内容预览: ${chunk.content.substring(0, 200)}...`)
      })
    } else {
      console.error('未知模式！请使用 single、full 或 hybrid')
      process.exit(1)
    }
  } catch (error) {
    console.error('\n错误:', error.message)
    if (error.response) {
      console.error('API响应:', error.response.data)
    }
    process.exit(1)
  }
}

main()
