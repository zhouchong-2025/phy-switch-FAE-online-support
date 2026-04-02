/**
 * 原理图图片分析测试（支持PNG/JPG格式）
 * 绕过PDF渲染问题，直接使用图片文件
 */

import 'dotenv/config'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

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
- 去耦电容清单：

【晶振】
- 频率：
- 负载电容：

【接口元件】
- 变压器/磁珠：
- 匹配电阻：
- 保护器件：

【其他被动元件】
- 所有电阻列表及阻值
- 所有电容列表及容值`,

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
如果让你审核这个��计，你会提出哪些改进意见？`,

  detail: `请详细分析这张原理图的每个部分：

【芯片引脚连接详情】
列出主芯片的所有可见引脚连接，格式：
- 引脚名称 → 连接的网络/元件 → 作用说明

【电路功能模块拆解】
识别并详细描述各个功能模块：
- 电源模块（所有电源轨和去耦方案）
- 时钟模块（晶振电路完整分析）
- MDI接口模块（变压器和匹配网络）
- LED指示模块
- 其他外围电路

【设计参数评估】
- 电源去耦电容是否合理？
- 晶振负载电容计算是否正确？
- 差分信号匹配是否到位？
- 是否有明显的设计缺陷？

请尽可能详细、专业。`
}

/**
 * 使用VLM分析原理图图片
 */
async function analyzeSchematicImage(imagePath, promptType = 'analysis') {
  const prompt = PROMPTS[promptType] || PROMPTS.analysis

  console.log(`\n读取图片: ${imagePath}`)
  const imageBuffer = fs.readFileSync(imagePath)
  const base64Image = imageBuffer.toString('base64')
  const ext = path.extname(imagePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'

  console.log(`图片大小: ${(base64Image.length / 1024).toFixed(2)} KB`)
  console.log(`使用Prompt策略: ${promptType}`)
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
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
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
    if (error.response?.data) {
      console.error('API错误详情:', JSON.stringify(error.response.data, null, 2))
    }
    throw error
  }
}

/**
 * 主测试函数
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
原理图图片智能分析工具

用法:
  npm run test-schematic-img <图片路径> [分析模式]

参数:
  图片路径    - PNG或JPG格式的原理图图片��必需）
  分析模式    - 可选: basic, component, analysis, fae, detail（默认: analysis）

分析模式说明:
  basic      - 基础文字识别
  component  - 元器件清单提取（BOM）
  analysis   - 技术分析（推荐）⭐
  fae        - FAE技术支持场景（推荐）⭐
  detail     - 详细电路分析

示例:
  npm run test-schematic-img ./schematic.png
  npm run test-schematic-img ./schematic.png analysis
  npm run test-schematic-img ./schematic.jpg fae

提示:
  如果你有PDF格式的原理图，可以先用以下方法转换为图片：
  1. 打开PDF，右键保存页面为PNG
  2. 使用在线工具转换
  3. 使用命令行工具: pdftoppm -png input.pdf output
    `)
    process.exit(0)
  }

  const imagePath = args[0]
  const promptType = args[1] || 'analysis'

  if (!fs.existsSync(imagePath)) {
    console.error(`错误: 文件不存在: ${imagePath}`)
    process.exit(1)
  }

  console.log('='.repeat(60))
  console.log('原理图智能分析测试（图片版）')
  console.log('='.repeat(60))
  console.log(`图片: ${imagePath}`)
  console.log(`分析模式: ${promptType}`)
  console.log('='.repeat(60))

  try {
    console.log('\n[1/2] 调用PaddleOCR-VL-1.5进行智能分析...')
    const startTime = Date.now()
    const analysis = await analyzeSchematicImage(imagePath, promptType)
    const endTime = Date.now()

    console.log(`✓ 分析完成 (耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒)`)

    // 输出结果
    console.log('\n[2/2] VLM分析结果:')
    console.log('='.repeat(60))
    console.log(analysis)
    console.log('='.repeat(60))

    // 保存结果
    const outputDir = './test-results'
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const basename = path.basename(imagePath, path.extname(imagePath))
    const outputFile = path.join(outputDir, `${basename}_${promptType}_${timestamp}.txt`)

    const report = `原理图VLM分析报告
===================
图片: ${imagePath}
分析模式: ${promptType}
分析时间: ${new Date().toLocaleString('zh-CN')}
耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒

VLM分析结果:
${analysis}

---
生成工具: PaddleOCR-VL-1.5
`

    fs.writeFileSync(outputFile, report, 'utf-8')
    console.log(`\n✓ 分析报告已保存: ${outputFile}`)

  } catch (error) {
    console.error('\n❌ 错误:', error.message)
    process.exit(1)
  }
}

main()
