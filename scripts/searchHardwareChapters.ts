/**
 * 搜索Datasheet中的硬件设计相关章节
 */

import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

dotenv.config()

const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
const workerUrl = `file:///${workerPath.replace(/\\/g, '/')}`
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

async function searchDatasheetForHardwareInfo() {
  const pdfPath = path.join(process.cwd(), 'Database', 'YT8522 Datasheet.pdf')

  if (!fs.existsSync(pdfPath)) {
    console.log('PDF文件不存在')
    return
  }

  const dataBuffer = fs.readFileSync(pdfPath)
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
    useSystemFonts: true,
  })

  const pdfDocument = await loadingTask.promise
  const numPages = pdfDocument.numPages

  console.log(`YT8522 Datasheet 总页数: ${numPages}\n`)

  const keywords = [
    'hardware', 'layout', 'pcb', 'design guideline',
    'application', 'schematic', 'reference design',
    'power supply', 'decoupling', '去耦', '布线',
    '硬件设计', '设计指南', '应用电路'
  ]

  console.log('搜索关键词:', keywords.join(', '))
  console.log('\n===== 搜索结果 =====\n')

  const foundPages: {page: number, keyword: string, snippet: string}[] = []

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum)
    const textContent = await page.getTextContent()
    const textItems = textContent.items as any[]
    const pageText = textItems.map((item: any) => item.str).join(' ')

    for (const keyword of keywords) {
      if (pageText.toLowerCase().includes(keyword.toLowerCase())) {
        const index = pageText.toLowerCase().indexOf(keyword.toLowerCase())
        const snippet = pageText.substring(Math.max(0, index - 50), Math.min(pageText.length, index + 100))

        foundPages.push({
          page: pageNum,
          keyword,
          snippet: snippet.replace(/\s+/g, ' ')
        })
      }
    }
  }

  // 按页码分组
  const groupedByPage = foundPages.reduce((acc, item) => {
    if (!acc[item.page]) {
      acc[item.page] = []
    }
    acc[item.page].push(item)
    return acc
  }, {} as Record<number, typeof foundPages>)

  console.log(`找到 ${Object.keys(groupedByPage).length} 页包含硬件设计相关内容\n`)

  // 显示每页的匹配情况
  for (const [pageNumStr, items] of Object.entries(groupedByPage)) {
    console.log(`\n页码 ${pageNumStr}:`)
    console.log(`  关键词: ${[...new Set(items.map(i => i.keyword))].join(', ')}`)
    console.log(`  片段: ${items[0].snippet.substring(0, 150)}...`)
  }
}

searchDatasheetForHardwareInfo().catch(console.error)
