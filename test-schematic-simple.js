/**
 * 原理图智能分析测试（简化版）
 * 使用已有的ocrParser模块
 */

import 'dotenv/config'
import OpenAI from 'openai'
import { testOCRSinglePage } from './lib/ocrParser.ts'
import fs from 'fs'
import path from 'path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas, Image } from 'canvas'

const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
const workerUrl = `file:///${workerPath.replace(/\\/g, '/')}`
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
})

// Prompt策略模板
const PROMPTS = {
  basic: `请识别这张原理图中的所有文字信息，包括：
1. 芯片型号和引脚名称
2. 元器件标注（电阻、电容、晶振等）及其参数
3. 网络标签（电源、地、信号名）
4. 其他重要文字信息

请按类别整理输出。`,

  component: `请提取这张原理图中的所有元器件清单（BOM），格式如下：
【主芯片】
- 型号：
- 封装：

【电源相关】
- 电源芯片/LDO：
- 去耦电容：

【晶振】
- 频率：
- 负载电容：

【接口元件】
- 变压器/磁珠：
- 匹配电阻：
- 保护器件：

【其他被动元件】
- 电阻列表：
- 电容列表：`,

  analysis: `这是一张PHY芯片的应用原理图，请作为硬件工程师进行技术分析：

【基本信息】
1. 主芯片型号是什么？
2. 使用的接口类型（RGMII/SGMII/MII/RMII等）？
3. 支持的端口数量和速率？

【电源设计】
1. 需要几路电源？电压值分别是多少？
2. 每路电源的去耦电容配置如何？
3. 是否有电源指示LED？

【时钟设计】
1. 晶振频率是多少？
2. 负载电容配置是否合理？

【MDI接口】
1. 使用的网络变压器型号？
2. 匹配电阻配置？
3. 是否有ESD保护？

【关键设计要点】
指出这个设计中的关键参数和需要注意的地方。`,

  fae: `你是一名经验丰富的FAE工程师，客户发来了这张PHY芯片原理图。请帮我：

【快速诊断】
1. 这是哪款PHY芯片的参考设计？
2. 设计是否符合datasheet推荐？
3. 有哪些潜在的设计风险？

【技术支持要点】
1. 如果客户说"PHY不工作"，应该首先检查哪些地方？
2. 电源去耦电容是否充足？位置是否合理？
3. 晶振电路有无问题？
4. MDI接口匹配是否正确？

【优化建议】
如果让你审核这个设计，你会提出哪些改进意见？`,

  detail: `请详细分析这张原理图的每个部分：

【芯片引脚连接】
列出主芯片的所有引脚连接，格式：
- 引脚名 → 连接到什么网络/元件

【电路功能模块】
识别并描述各个功能模块：
- 电源模块
- 时钟模块
- MDI接口模块
- LED指示模���
- 其他模块

【信号完整性考虑】
- 差分信号的走线和匹配
- 高速信号的处理
- 电源平面和地平面

请尽可能详细。`
}

/**
 * 渲染PDF页面为图片（修复版）
 */
async function renderPageToImage(page, scale = 2.5) {
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(viewport.width, viewport.height)
  const ctx = canvas.getContext('2d')

  // 设置白色背景
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, viewport.width, viewport.height)

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  }

  await page.render(renderContext).promise

  return canvas.toBuffer('image/png').toString('base64')
}

/**
 * 使用VLM分析原理图
 */
async function analyzeSchematicWithVLM(base64Image, promptType = 'analysis') {
  const prompt = PROMPTS[promptType] || PROMPTS.analysis

  console.log(`\n使用Prompt策略: ${promptType}`)
  console.log('='.repeat(60))

  try {
    const response = await client.chat.completions.create({
      model: 'PaddlePaddle/PaddleOCR-VL-1.5',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${base64Image}` },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    })

    return response.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('VLM分析失败:', error.message)
    throw error
  }
}

/**
 * 主测试函数
 */
async function main() {
  const args = process.argv.slice(2)
  const pdfPath = args[0] || './Database/YT8522_REF_Schematic.pdf'
  const pageNum = args[1] ? parseInt(args[1]) : 2
  const promptType = args[2] || 'analysis'

  console.log('='.repeat(60))
  console.log('原理图智能分析测试（VLM版）')
  console.log('='.repeat(60))
  console.log(`PDF: ${pdfPath}`)
  console.log(`页码: ${pageNum}`)
  console.log(`分析模式: ${promptType}`)
  console.log('='.repeat(60))

  try {
    // 加载PDF
    console.log('\n[1/3] 加载PDF并渲染为图片...')
    const dataBuffer = fs.readFileSync(pdfPath)
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(dataBuffer),
      useSystemFonts: true,
    })

    const pdfDocument = await loadingTask.promise
    const page = await pdfDocument.getPage(pageNum)

    const base64Image = await renderPageToImage(page)
    console.log(`✓ 图片生成完成 (${(base64Image.length / 1024).toFixed(2)} KB)`)

    // VLM分析
    console.log('\n[2/3] 调用PaddleOCR-VL-1.5进行智能分析...')
    const startTime = Date.now()
    const analysis = await analyzeSchematicWithVLM(base64Image, promptType)
    const endTime = Date.now()

    console.log(`✓ 分析完成 (耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒)`)

    // 输出结果
    console.log('\n[3/3] VLM分析结果:')
    console.log('='.repeat(60))
    console.log(analysis)
    console.log('='.repeat(60))

    // 保存结果
    const outputDir = './test-results'
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const outputFile = path.join(outputDir, `schematic_${promptType}_${timestamp}.txt`)

    const report = `原理图VLM分析报告
===================
PDF: ${pdfPath}
页码: ${pageNum}
分析模式: ${promptType}
分析时间: ${new Date().toLocaleString('zh-CN')}
耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒

VLM分析结果:
${analysis}
`

    fs.writeFileSync(outputFile, report, 'utf-8')
    console.log(`\n✓ 分析报告已保存: ${outputFile}`)

  } catch (error) {
    console.error('\n❌ 错误:', error.message)
    if (error.stack) {
      console.error('\n堆栈跟踪:', error.stack)
    }
    process.exit(1)
  }
}

// 帮助���息
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
原理图智能分析测试工具

用法:
  npm run test-schematic [PDF路径] [页码] [分析模式]

参数:
  PDF路径    - PDF文件路径（默认: ./Database/YT8522_REF_Schematic.pdf）
  页码       - 要分析的页码（默认: 2）
  分析模式   - 可选: basic, component, analysis, fae, detail（默认: analysis）

分析模式说明:
  basic      - 基础文字识别
  component  - 元器件清单提取（BOM）
  analysis   - 技术分析（推荐）
  fae        - FAE技术支持场景（推荐）
  detail     - 详细电路分析

示例:
  npm run test-schematic
  npm run test-schematic "./Database/YT8522_REF_Schematic.pdf" 2 analysis
  npm run test-schematic "./Database/YT8522_REF_Schematic.pdf" 2 fae
  `)
  process.exit(0)
}

main()
