/**
 * 检查Datasheet第17页的内容
 */

import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
const workerUrl = `file:///${workerPath.replace(/\\/g, '/')}`
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkPage17() {
  console.log('===== 检查YT8522 Datasheet第17页 =====\n')

  // 1. 从数据库查询第17页的内容
  const { data: chunks } = await supabase
    .from('documents')
    .select('content, metadata')
    .eq('metadata->>source', 'YT8522 Datasheet.pdf')
    .eq('metadata->>page', '17')

  console.log(`数据库中第17页的文档块数: ${chunks?.length || 0}\n`)

  if (chunks && chunks.length > 0) {
    chunks.forEach((chunk, idx) => {
      console.log(`\n文档块 ${idx + 1}:`)
      console.log('内容长度:', chunk.content.length, '字符')
      console.log('内容预览:')
      console.log(chunk.content.substring(0, 500))
      console.log('...\n')
    })
  } else {
    console.log('✗ 数据库中没有第17页的内容！\n')
  }

  // 2. 从实际PDF读取第17页
  const pdfPath = path.join(process.cwd(), 'Database', 'YT8522 Datasheet.pdf')
  const dataBuffer = fs.readFileSync(pdfPath)
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
    useSystemFonts: true,
  })

  const pdfDocument = await loadingTask.promise
  const page = await pdfDocument.getPage(17)
  const textContent = await page.getTextContent()
  const textItems = textContent.items as any[]
  const pageText = textItems.map((item: any) => item.str).join(' ').replace(/\s+/g, ' ').trim()

  console.log('PDF第17页实际内容:')
  console.log('内容长度:', pageText.length, '字符')
  console.log('内容预览:')
  console.log(pageText.substring(0, 800))

  console.log('\n\n===== 分析 =====')
  if (pageText.length < 100) {
    console.log('✗ 第17页文字内容太少（可能主要是图表），导致向量检索效果差')
    console.log('  建议：增强PDF解析，提取图表标题和说明')
  }

  if (chunks && chunks.length > 0) {
    const dbText = chunks[0].content.substring(0, 100).toLowerCase().replace(/\s+/g, '')
    const pdfText = pageText.substring(0, 100).toLowerCase().replace(/\s+/g, '')

    if (pdfText.includes(dbText.substring(0, 30))) {
      console.log('✓ 数据库内容与PDF一致')
    } else {
      console.log('✗ 数据库内容与PDF不一致')
    }
  }
}

checkPage17().catch(console.error)
