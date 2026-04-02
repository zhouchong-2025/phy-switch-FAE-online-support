/**
 * 测试Qwen2-VL对原理图的识别和分析能力
 * 对比不同VLM模型的效果
 */

import 'dotenv/config'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
})

// 硅基流动支持的VLM模型（更新实际支持的模型名）
const AVAILABLE_MODELS = {
  'qwen-vl-plus': 'Qwen/Qwen-VL-Plus',  // 千问VL增强版
  'qwen-vl-max': 'Qwen/Qwen-VL-Max',    // 千问VL最强版
  'qwen2-vl': 'Qwen/Qwen2-VL-72B-Instruct',  // Qwen2-VL 72B
  'paddleocr': 'PaddlePaddle/PaddleOCR-VL-1.5',
}

// 原理图分析专用Prompt
const SCHEMATIC_PROMPT = `你是一位资深的硬件工程师，专门分析PHY芯片原理图。

请详细分析这张原理图并提取以下信息：

【1. 基本信息】
- 主芯片型号：
- 芯片功能：
- 端口数量：

【2. 电源设计】
- 电源轨清单（VDD、AVDD等）：
- 去耦电容配置：
- LDO/DCDC方案：

【3. 时钟设计】
- 晶振频率：
- 负载电容：
- 时钟输入方式：

【4. 接口设计】
- MAC接口类型（RGMII/SGMII/MII）：
- MDI接口：
- 网络变压器型号：
- 匹配电阻配置：

【5. 关键元器件】
列出所有可识别的元器件，格式：
- 编号：型号/参数

【6. 设计评估】
- 设计是否合理：
- 潜在问题：
- 优化建议：

请尽可能详细、准确地提取信息。如果某些信息无法从原理图中识别，请明确说明。`

/**
 * 使用VLM分析原理图
 */
async function analyzeWithVLM(imagePath, modelKey = 'qwen2-vl-7b') {
  const modelName = AVAILABLE_MODELS[modelKey]
  if (!modelName) {
    throw new Error(`不支持的模型: ${modelKey}。可选: ${Object.keys(AVAILABLE_MODELS).join(', ')}`)
  }

  console.log(`\n使用模型: ${modelName}`)

  // 读取图片
  const imageBuffer = fs.readFileSync(imagePath)
  const base64Image = imageBuffer.toString('base64')
  const ext = path.extname(imagePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'

  console.log(`图片大小: ${(base64Image.length / 1024).toFixed(2)} KB`)
  console.log('开始分析...')

  try {
    const startTime = Date.now()

    const response = await client.chat.completions.create({
      model: modelName,
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
              text: SCHEMATIC_PROMPT,
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    })

    const endTime = Date.now()
    const result = response.choices[0]?.message?.content || ''

    console.log(`✓ 分析完成 (耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒)`)

    return {
      model: modelName,
      result,
      duration: endTime - startTime,
    }
  } catch (error) {
    console.error(`❌ 分析失败: ${error.message}`)
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
Qwen2-VL 原理图识别测试工具

用法:
  npm run test-qwen-vl <图片路径> [模型]

参数:
  图片路径  - 原理图PNG/JPG文件（必需）
  模型      - 可选模型（默认: qwen2-vl-7b）

可用模型:
  qwen-vl-plus  - Qwen-VL-Plus（推荐，均衡）⭐
  qwen-vl-max   - Qwen-VL-Max（最强，慢）⭐⭐
  qwen2-vl      - Qwen2-VL-72B-Instruct（备选）
  paddleocr     - PaddleOCR-VL-1.5（已证明不可用）❌

示例:
  npm run test-qwen-vl "./Database/YT8522 SCH.png"
  npm run test-qwen-vl "./Database/YT8522 SCH.png" qwen-vl-plus
  npm run test-qwen-vl "./Database/YT8522 SCH.png" qwen-vl-max
    `)
    process.exit(0)
  }

  const imagePath = args[0]
  const modelKey = args[1] || 'qwen-vl-plus'  // 默认使用Qwen-VL-Plus

  if (!fs.existsSync(imagePath)) {
    console.error(`错误: 文件不存在: ${imagePath}`)
    process.exit(1)
  }

  console.log('='.repeat(60))
  console.log('Qwen2-VL 原理图识别测试')
  console.log('='.repeat(60))
  console.log(`图片: ${imagePath}`)
  console.log(`模型: ${modelKey}`)
  console.log('='.repeat(60))

  try {
    const analysis = await analyzeWithVLM(imagePath, modelKey)

    console.log('\n' + '='.repeat(60))
    console.log('VLM分析结果:')
    console.log('='.repeat(60))
    console.log(analysis.result)
    console.log('='.repeat(60))

    // 保存结果
    const outputDir = './test-results'
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const basename = path.basename(imagePath, path.extname(imagePath))
    const outputFile = path.join(outputDir, `${basename}_${modelKey}_${timestamp}.txt`)

    const report = `Qwen2-VL 原理图分析报告
===================
图片: ${imagePath}
模型: ${analysis.model}
分析时间: ${new Date().toLocaleString('zh-CN')}
耗时: ${(analysis.duration / 1000).toFixed(2)}秒

分析结果:
${analysis.result}

---
模型: ${analysis.model}
`

    fs.writeFileSync(outputFile, report, 'utf-8')
    console.log(`\n✓ 分析报告已保存: ${outputFile}`)

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message)
    process.exit(1)
  }
}

main()
