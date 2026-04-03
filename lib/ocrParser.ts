import 'dotenv/config'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import pdfParse from 'pdf-parse'
import { PDFChunk } from './pdfParser'

// 初始化硅基流动客户端
const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY!,
  baseURL: 'https://api.siliconflow.cn/v1',
})

/**
 * 使用pdf-parse解析PDF文件（已废弃OCR渲染功能）
 * @param filePath PDF文件路径
 * @param ocrAllPages 已废弃参数，保留以兼容旧代码
 */
export async function parsePDFWithOCR(
  filePath: string,
  ocrAllPages: boolean = false
): Promise<PDFChunk[]> {
  const dataBuffer = fs.readFileSync(filePath)
  const fileName = path.basename(filePath)

  console.log(`正在解析 PDF: ${fileName}`)

  // 使用 pdf-parse 提取文本
  const data = await pdfParse(dataBuffer)
  console.log(`  总页数: ${data.numpages}`)
  console.log(`  提取文本长度: ${data.text.length} 字符`)

  // 分块处理
  const chunks: PDFChunk[] = []
  const pageChunks = splitIntoChunks(data.text, 2000)

  pageChunks.forEach((chunk, chunkIndex) => {
    chunks.push({
      content: chunk.trim(),
      metadata: {
        source: fileName,
        page: 1, // pdf-parse 不提供分页信息
        chunkIndex,
      },
    })
  })

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
 * 测试PDF文本提取功能（已移除OCR渲染）
 */
export async function testOCRSinglePage(filePath: string, pageNum: number = 1) {
  const dataBuffer = fs.readFileSync(filePath)

  console.log(`测试 PDF 文本提取`)

  const data = await pdfParse(dataBuffer)
  console.log(`提取文本长度: ${data.text.length} 字符`)
  console.log(`\n提取结果:\n${data.text.substring(0, 500)}...`)

  return data.text
}
