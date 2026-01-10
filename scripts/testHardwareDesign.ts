/**
 * 测试硬件设计注意事项查询
 * 检查实际检索到的内容是否相关
 */

import dotenv from 'dotenv'
import { searchDocuments } from '../lib/vectorStore'
import path from 'path'
import fs from 'fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

// 加载环境变量
dotenv.config()

// 配置 PDF.js worker
const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
const workerUrl = `file:///${workerPath.replace(/\\/g, '/')}`
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * 从PDF页面提取文本
 */
async function extractPageText(pdfPath: string, pageNum: number): Promise<string> {
  const dataBuffer = fs.readFileSync(pdfPath)
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
    useSystemFonts: true,
  })

  const pdfDocument = await loadingTask.promise
  const page = await pdfDocument.getPage(pageNum)
  const textContent = await page.getTextContent()
  const textItems = textContent.items as any[]

  return textItems
    .map((item: any) => item.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function testHardwareDesignQuery() {
  console.log('===== 测试硬件设计注意事项查询 =====\n')

  const query = 'YT8522硬件设计注意事项'
  console.log(`查询: ${query}\n`)

  // 执行检索
  const results = await searchDocuments(query, 10)

  console.log(`检索到 ${results.length} 个结果\n`)

  // 分析每个结果
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    console.log(`\n===== 结果 ${i + 1} =====`)
    console.log(`文件: ${result.source}`)
    console.log(`页码: ${result.page}`)
    console.log(`相似度: ${(result.similarity * 100).toFixed(1)}%`)
    console.log(`\n内容预览:`)
    console.log(result.content.substring(0, 300).replace(/\n/g, ' '))
    console.log('...\n')

    // 检查内容是否包含硬件设计相关关键词
    const hardwareKeywords = [
      '硬件', 'hardware', 'layout', '布线', 'PCB', 'design',
      '电源', 'power', '去耦', 'decoupling', '电容', 'capacitor',
      'schematic', '原理图', '参考设计', 'reference', '设计指南',
      '注意事项', 'guideline', 'recommendation'
    ]

    const foundKeywords = hardwareKeywords.filter(kw =>
      result.content.toLowerCase().includes(kw.toLowerCase())
    )

    if (foundKeywords.length > 0) {
      console.log(`✓ 包含相关关键词: ${foundKeywords.join(', ')}`)
    } else {
      console.log(`✗ 未包含硬件设计相关关键词`)
    }

    // 如果是Datasheet，读取实际PDF内容对比
    if (result.source.includes('Datasheet') && fs.existsSync(path.join(process.cwd(), 'Database', result.source))) {
      const pdfPath = path.join(process.cwd(), 'Database', result.source)
      try {
        const actualContent = await extractPageText(pdfPath, result.page)
        console.log(`\nPDF第${result.page}页实际内容预览:`)
        console.log(actualContent.substring(0, 200).replace(/\s+/g, ' '))

        // 检查是否匹配
        const dbContentShort = result.content.substring(0, 100).toLowerCase().replace(/\s+/g, '')
        const pdfContentShort = actualContent.substring(0, 100).toLowerCase().replace(/\s+/g, '')

        if (pdfContentShort.includes(dbContentShort.substring(0, 30))) {
          console.log(`\n✓ 数据库内容与PDF一致`)
        } else {
          console.log(`\n✗ 数据库内容与PDF不一致（可能是分块问题）`)
        }
      } catch (err) {
        console.log(`\n无法读取PDF: ${err}`)
      }
    }
  }

  // 分析结果分布
  console.log('\n\n===== 结果分析 =====\n')

  const sourceDistribution = results.reduce((acc, r) => {
    acc[r.source] = (acc[r.source] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('文档分布:')
  Object.entries(sourceDistribution).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}个结果`)
  })

  // 检查是否有更相关的页面被遗漏
  console.log('\n建议检查的章节:')
  console.log('  - Datasheet的"Hardware Design"或"Layout Guidelines"章节')
  console.log('  - Datasheet的"Application Information"章节')
  console.log('  - AppNote中的设计建议部分')
  console.log('  - Reference Schematic中的设计说明')
}

testHardwareDesignQuery().catch(console.error)
