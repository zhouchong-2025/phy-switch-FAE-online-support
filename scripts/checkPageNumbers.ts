/**
 * 验证PDF页码对应关系
 * 检查向量数据库中存储的页码是否与实际PDF页码对应
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

// 加载环境变量
dotenv.config()

// 配置 PDF.js worker
const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
const workerUrl = `file:///${workerPath.replace(/\\/g, '/')}`
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// 初始化Supabase客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * 从PDF页面提取文本片段（前100字符）
 */
async function extractPagePreview(page: any): Promise<string> {
  const textContent = await page.getTextContent()
  const textItems = textContent.items as any[]

  const fullText = textItems
    .map((item: any) => item.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return fullText.substring(0, 100) + '...'
}

/**
 * 检查指定PDF的页码对应关系
 */
async function checkPDFPages(fileName: string) {
  console.log(`\n====== 检查文件: ${fileName} ======\n`)

  // 1. 从数据库查询该文件的文档块
  const { data: chunks, error } = await supabase
    .from('documents')
    .select('content, metadata')
    .eq('metadata->>source', fileName)  // 使用JSON操作符查询source
    .limit(100)

  if (error) {
    console.error('查询数据库失败:', error)
    return
  }

  if (!chunks || chunks.length === 0) {
    console.log('数据库中没有找到该文件的记录')
    return
  }

  // 从metadata中提取page和chunkIndex
  const processedChunks = chunks.map((c: any) => ({
    content: c.content,
    page: c.metadata.page,
    chunkIndex: c.metadata.chunkIndex || c.metadata.chunk_index
  })).sort((a: any, b: any) => {
    if (a.page !== b.page) return a.page - b.page
    return a.chunkIndex - b.chunkIndex
  })

  console.log(`数据库中共有 ${processedChunks.length} 个文档块`)

  // 2. 打开实际PDF文件
  const pdfPath = path.join(process.cwd(), 'Database', fileName)

  if (!fs.existsSync(pdfPath)) {
    console.log(`PDF文件不存在: ${pdfPath}`)
    return
  }

  const dataBuffer = fs.readFileSync(pdfPath)
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
    useSystemFonts: true,
  })

  const pdfDocument = await loadingTask.promise
  const numPages = pdfDocument.numPages

  console.log(`PDF文件总页数: ${numPages}`)

  // 3. 获取数据库中的不同页码
  const uniquePages = [...new Set(processedChunks.map((c: any) => c.page))].sort((a, b) => a - b)
  console.log(`\n数据库中记录的页码: ${uniquePages.join(', ')}`)

  // 4. 对比几个关键页
  console.log('\n===== 页码对应关系验证 =====\n')

  const pagesToCheck = [uniquePages[0], uniquePages[Math.floor(uniquePages.length / 2)], uniquePages[uniquePages.length - 1]]

  for (const pageNum of pagesToCheck) {
    console.log(`\n--- 页码 ${pageNum} ---`)

    // 从数据库获取该页内容
    const dbChunk = processedChunks.find((c: any) => c.page === pageNum)
    if (dbChunk) {
      console.log('数据库中的内容预览:')
      console.log(dbChunk.content.substring(0, 150).replace(/\n/g, ' ') + '...')
    }

    // 从PDF获取该页内容
    try {
      const page = await pdfDocument.getPage(pageNum)
      const preview = await extractPagePreview(page)
      console.log('\nPDF文件中的内容预览:')
      console.log(preview)

      // 简单对比
      const dbContent = dbChunk?.content.substring(0, 50).toLowerCase().replace(/\s+/g, '')
      const pdfContent = preview.substring(0, 50).toLowerCase().replace(/\s+/g, '')

      if (dbContent && pdfContent) {
        const similarity = dbContent === pdfContent ? '✓ 完全匹配' :
                          pdfContent.includes(dbContent.substring(0, 20)) ? '✓ 部分匹配' :
                          '✗ 不匹配'
        console.log(`\n对比结果: ${similarity}`)
      }
    } catch (err) {
      console.log(`无法读取PDF第${pageNum}页:`, err)
    }
  }

  console.log('\n===== 页码说明 =====')
  console.log('- 数据库存储的页码是PDF的物理页码（从1开始）')
  console.log('- 这个页码对应PDF阅读器中的"物理页码"，而非"显示页码"')
  console.log('- 如果PDF有封面/目录，显示页码可能与物理页码不同')
  console.log('  例如：物理第10页 ≠ 内容第10页（如果前面有封面）')
}

// 主函数
async function main() {
  console.log('===== PDF页码对应关系检查工具 =====\n')

  // 获取命令行参数
  const fileName = process.argv[2]

  if (fileName) {
    // 检查指定文件
    await checkPDFPages(fileName)
  } else {
    // 列出所有可用文件
    const { data: sources } = await supabase
      .from('documents')
      .select('source')
      .limit(100)

    if (sources && sources.length > 0) {
      const uniqueSources = [...new Set(sources.map(s => s.source))].sort()
      console.log('数据库中的文件列表:')
      uniqueSources.forEach((source, idx) => {
        console.log(`  ${idx + 1}. ${source}`)
      })

      console.log('\n使用方法:')
      console.log('  npm run check-pages "文件名.pdf"')
      console.log('\n示例:')
      console.log('  npm run check-pages "YT8522 Datasheet.pdf"')
    }
  }
}

main().catch(console.error)
