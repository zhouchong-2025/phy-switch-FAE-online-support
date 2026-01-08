import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

// 配置 PDF.js worker（Windows兼容）
const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
// 将Windows路径转换为file:// URL
const workerUrl = `file:///${workerPath.replace(/\\/g, '/')}`
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface PDFChunk {
  content: string
  metadata: {
    source: string
    page: number
    chunkIndex: number
  }
}

/**
 * 增强Product Selection Guide表格行的语义
 */
function enhanceProductSelectionContent(content: string, fileName: string): string {
  // 只处理Product Selection Guide
  if (!fileName.includes('Product Selection Guide')) {
    return content
  }

  // T1芯片型号列表（100BASE-T1车载以太网）
  const t1Chips = ['YT8010A', 'YT8010AN', 'YT8011A', 'YT8011AN', 'YT8011AR']

  // 按行分割，为每个包含YT型号的行单独增强
  const lines = content.split(/(?=YT\d{3,4}[A-Z]*)/)
  const enhancedLines = lines.map(line => {
    const ytModelMatch = line.match(/YT\d{3,4}[A-Z]*/)
    if (!ytModelMatch) return line

    const model = ytModelMatch[0]
    let enhancement = ''

    // 判断是T1还是TX芯片 - 使用简洁标注
    const isT1Chip = t1Chips.some(t1 => model.toUpperCase().includes(t1))

    if (isT1Chip) {
      // T1芯片 - 简洁标注
      enhancement += ` [T1车载以太网]`
    } else {
      // TX芯片 - 检测接口类型并简洁标注
      const hasRGMII = /RGMII/i.test(line)
      const hasSGMII = /SGMII/i.test(line)
      const hasMII = /\b(MII|RMII)\b/i.test(line) // 添加MII/RMII检测

      if (hasRGMII || hasSGMII || hasMII) {
        enhancement += ` [TX接口PHY]`
      }
    }

    // 车规标注增强：明确写"车规芯片"
    if (line.includes('Automotive') || line.includes('AEC-Q100')) {
      enhancement += ` [车规芯片]`
      enhancement += `\n\n[产品说明] ${model}是车规认证芯片，支持AEC-Q100标准。`

      // 提取等级信息
      if (line.includes('Grade 2')) {
        enhancement += ` 满足AEC-Q100 Grade 2等级要求（工作温度-40°C to +105°C）。`
      } else if (line.includes('Grade 1')) {
        enhancement += ` 满足AEC-Q100 Grade 1等级要求（工作温度-40°C to +125°C）。`
      }
    } else if (line.includes('车规') || line.includes('车载')) {
      // 处理中文车规标记
      enhancement += ` [车规芯片]`
      enhancement += `\n\n[产品说明] ${model}是车规认证芯片。`
      if (line.includes('车规')) {
        enhancement += ` 符合汽车电子车规要求。`
      }
      if (line.includes('车载')) {
        enhancement += ` 适用于车载以太网应用。`
      }
    }

    // 为所有产品添加温度范围说明
    const tempMatch = line.match(/(-?\d+)°C-(-?\d+)°C/)
    if (tempMatch) {
      if (!enhancement) {
        enhancement += `\n\n[产品说明] ${model}芯片规格：`
      }
      enhancement += ` 工作温度范围${tempMatch[1]}°C至${tempMatch[2]}°C。`
      const minTemp = parseInt(tempMatch[1])
      if (minTemp <= -40) {
        enhancement += ` 支持工业级温度范围。`
      }
    }

    // 为所有产品添加等级标识
    if (line.includes('工业级')) {
      if (!enhancement) {
        enhancement += `\n\n[产品说明] ${model}芯片规格：`
      }
      enhancement += ` 属于工业级产品。`
    }

    return line + enhancement
  })

  return enhancedLines.join('')
}

/**
 * 从PDF页面提取文本
 */
async function extractPageText(page: any): Promise<string> {
  const textContent = await page.getTextContent()
  const textItems = textContent.items as any[]

  // 将文本项按位置排序并组合
  return textItems
    .map((item: any) => item.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 解析单个PDF文件（使用pdfjs-dist逐页提取）
 */
export async function parsePDF(filePath: string): Promise<PDFChunk[]> {
  const dataBuffer = fs.readFileSync(filePath)
  const fileName = path.basename(filePath)

  console.log(`正在解析: ${fileName}`)

  // 加载PDF文档
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
    useSystemFonts: true,
  })

  const pdfDocument = await loadingTask.promise
  const numPages = pdfDocument.numPages

  console.log(`  总页数: ${numPages}`)

  const chunks: PDFChunk[] = []

  // 逐页提取文本
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum)
    const pageText = await extractPageText(page)

    if (pageText.trim().length === 0) {
      console.log(`  跳过空白页: ${pageNum}`)
      continue
    }

    // 将每页内容分块（每500字符一块，保持完整句子）
    // Selection Guide类文档会自动使用更大的块或整页模式
    const pageChunks = splitIntoChunks(pageText, 500, fileName)

    pageChunks.forEach((chunk, chunkIndex) => {
      // 增强Product Selection Guide的内容
      const enhancedChunk = enhanceProductSelectionContent(chunk, fileName)

      chunks.push({
        content: enhancedChunk.trim(),
        metadata: {
          source: fileName,
          page: pageNum, // 真实的PDF页码（从1开始）
          chunkIndex,
        },
      })
    })

    if (pageNum % 10 === 0) {
      console.log(`  已处理 ${pageNum}/${numPages} 页`)
    }
  }

  console.log(`  完成: 生成 ${chunks.length} 个文档块`)

  return chunks
}

/**
 * 将文本分割成合适的块，保持句子完整性
 * 针对不同类型的文档使用不同的分块策略
 */
function splitIntoChunks(text: string, maxLength: number, fileName: string = ''): string[] {
  const chunks: string[] = []

  // 检测Selection Guide类文档 - 使用更大的块以保持表格完整性
  const isSelectionGuide = /Selection\s*Guide|选型指南|选型表|Product.*Guide/i.test(fileName)

  if (isSelectionGuide) {
    // Selection Guide使用2000字符的大块
    maxLength = 2000

    // 如果整页内容<3000字符，直接作为一个块（通常是1页密集表格）
    if (text.length < 3000) {
      console.log(`  Selection Guide单页模式: ${text.length}字符作为1个块`)
      return [text]
    }

    // 检测型号密度：如果包含5个以上型号且长度<5000，也作为一个块
    const modelCount = (text.match(/YT\d{4}[A-Z]*/g) || []).length
    if (modelCount >= 5 && text.length < 5000) {
      console.log(`  Selection Guide密集表格模式: ${modelCount}个型号，${text.length}字符作为1个块`)
      return [text]
    }
  }

  const sentences = text.split(/[。！？\n]+/)

  let currentChunk = ''

  for (const sentence of sentences) {
    if (!sentence.trim()) continue

    if ((currentChunk + sentence).length > maxLength && currentChunk) {
      chunks.push(currentChunk)
      currentChunk = sentence
    } else {
      currentChunk += (currentChunk ? '。' : '') + sentence
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks
}

/**
 * 解析Database文件夹中的所有PDF
 */
export async function parseAllPDFs(databasePath: string): Promise<PDFChunk[]> {
  const files = fs.readdirSync(databasePath).filter(file => file.endsWith('.pdf'))

  console.log(`找到 ${files.length} 个PDF文件`)

  const allChunks: PDFChunk[] = []

  for (const file of files) {
    const filePath = path.join(databasePath, file)
    try {
      const chunks = await parsePDF(filePath)
      allChunks.push(...chunks)
    } catch (error) {
      console.error(`解析 ${file} 失败:`, error)
    }
  }

  console.log(`\n总计生成 ${allChunks.length} 个文档块`)

  return allChunks
}

/**
 * 将解析结果保存到JSON文件（备份）
 */
export function saveChunksToJSON(chunks: PDFChunk[], outputPath: string) {
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(outputPath, JSON.stringify(chunks, null, 2), 'utf-8')
  console.log(`已保存 ${chunks.length} 个文档块到 ${outputPath}`)
}
