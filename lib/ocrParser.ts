import 'dotenv/config'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from 'canvas'
import { PDFChunk } from './pdfParser'

// 配置 PDF.js worker
const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
const workerUrl = `file:///${workerPath.replace(/\\/g, '/')}`
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// 初始化硅基流动客户端
const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY!,
  baseURL: 'https://api.siliconflow.cn/v1',
})

/**
 * 将PDF页面渲染为Base64图片
 */
async function renderPageToBase64(page: any): Promise<string> {
  const viewport = page.getViewport({ scale: 2.0 }) // 提高分辨率以改善OCR效果
  const canvas = createCanvas(viewport.width, viewport.height)
  const context = canvas.getContext('2d')

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  }

  await page.render(renderContext).promise

  // 转换为Base64
  const base64Image = canvas.toBuffer('image/png').toString('base64')
  return `data:image/png;base64,${base64Image}`
}

/**
 * 使用PaddleOCR-VL-1.5进行OCR识别
 */
async function ocrImageWithPaddle(base64Image: string): Promise<string> {
  try {
    const response = await client.chat.completions.create({
      model: 'PaddlePaddle/PaddleOCR-VL-1.5',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: base64Image,
              },
            },
            {
              type: 'text',
              text: '请识别图片中的所有文字内容，保持原有格式和布局。如果是表格，请保留表格结构。',
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1, // 降低温度以提高准确性
    })

    const ocrText = response.choices[0]?.message?.content || ''
    return ocrText.trim()
  } catch (error: any) {
    console.error('OCR识别失败:', error.message)
    throw error
  }
}

/**
 * 使用OCR解析单个PDF文件
 * @param filePath PDF文件路径
 * @param ocrAllPages 是否对所有页面进行OCR（默认false，仅在文本提取失败时使用OCR）
 */
export async function parsePDFWithOCR(
  filePath: string,
  ocrAllPages: boolean = false
): Promise<PDFChunk[]> {
  const dataBuffer = fs.readFileSync(filePath)
  const fileName = path.basename(filePath)

  console.log(`正在使用OCR解析: ${fileName}`)

  // 加载PDF文档
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
    useSystemFonts: true,
  })

  const pdfDocument = await loadingTask.promise
  const numPages = pdfDocument.numPages

  console.log(`  总页数: ${numPages}`)

  const chunks: PDFChunk[] = []

  // 逐页处理
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum)
    let pageText = ''

    if (!ocrAllPages) {
      // 先尝试文本提取
      try {
        const textContent = await page.getTextContent()
        const textItems = textContent.items as any[]
        pageText = textItems
          .map((item: any) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      } catch (error) {
        console.log(`  页面 ${pageNum} 文本提取失败，使用OCR`)
      }
    }

    // 如果文本为空或强制OCR，使用OCR识别
    if (pageText.length < 50 || ocrAllPages) {
      console.log(`  页面 ${pageNum} 使用OCR识别...`)
      try {
        const base64Image = await renderPageToBase64(page)
        pageText = await ocrImageWithPaddle(base64Image)
        console.log(`  页面 ${pageNum} OCR完成，识别 ${pageText.length} 字符`)
      } catch (error: any) {
        console.error(`  页面 ${pageNum} OCR失败:`, error.message)
        continue
      }
    }

    if (pageText.trim().length === 0) {
      console.log(`  跳过空白页: ${pageNum}`)
      continue
    }

    // 分块处理（每2000字符一块，保持表格完整性）
    const pageChunks = splitIntoChunks(pageText, 2000)

    pageChunks.forEach((chunk, chunkIndex) => {
      chunks.push({
        content: chunk.trim(),
        metadata: {
          source: fileName,
          page: pageNum,
          chunkIndex,
        },
      })
    })

    if (pageNum % 5 === 0) {
      console.log(`  已处理 ${pageNum}/${numPages} 页`)
    }
  }

  console.log(`  完成: 生成 ${chunks.length} 个文档块`)

  return chunks
}

/**
 * 简单的文本分块函数
 */
function splitIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = []

  // 如果文本长度小于最大长度，直接返回
  if (text.length < maxLength) {
    return [text]
  }

  // 按段落分割
  const paragraphs = text.split(/\n\n+/)
  let currentChunk = ''

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim())
      currentChunk = paragraph
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

/**
 * ���试OCR功能（单页）
 */
export async function testOCRSinglePage(filePath: string, pageNum: number = 1) {
  const dataBuffer = fs.readFileSync(filePath)

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
    useSystemFonts: true,
  })

  const pdfDocument = await loadingTask.promise
  const page = await pdfDocument.getPage(pageNum)

  console.log(`测试OCR - 页面 ${pageNum}`)

  const base64Image = await renderPageToBase64(page)
  console.log(`图片渲染完成，大小: ${base64Image.length} 字符`)

  const ocrText = await ocrImageWithPaddle(base64Image)
  console.log(`\nOCR识别结果:\n${ocrText}`)

  return ocrText
}
