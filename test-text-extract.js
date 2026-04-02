import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
const workerUrl = `file:///${workerPath.replace(/\\/g, '/')}`
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

async function testTextExtraction(filePath, pageNum = 1) {
  const dataBuffer = fs.readFileSync(filePath)

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
    useSystemFonts: true,
  })

  const pdfDocument = await loadingTask.promise
  const page = await pdfDocument.getPage(pageNum)
  const textContent = await page.getTextContent()
  const textItems = textContent.items
  const text = textItems.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim()

  console.log('=== 传统pdfjs-dist文本提取结果 ===')
  console.log('总字符数:', text.length)
  console.log('\n前800字符内容:')
  console.log(text.substring(0, 800))
  console.log('...\n')

  return text
}

const filePath = process.argv[2] || './Database/Product Selection Guide.pdf'
const pageNum = process.argv[3] ? parseInt(process.argv[3]) : 1

testTextExtraction(filePath, pageNum).catch(console.error)
