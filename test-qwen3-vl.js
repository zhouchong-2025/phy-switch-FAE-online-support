/**
 * Qwen3-VL-32B-Thinking 原理图识别测试
 * 这是一个支持思维链推理的强大视觉语言模型
 */

import 'dotenv/config'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
})

const SCHEMATIC_ANALYSIS_PROMPT = `你是一位资深的硬件工程师，专门分析PHY芯片原理图。

请详细分析这张原理图并提取以下信息：

【1. 基本识别】
- 主芯片型号：
- 芯片类型和功能：
- 设计标题和版本号：

【2. 电源设计】
- 识别所有电源轨（AVDD、DVDD、VDD等）
- 列出每路电源的去耦电容配置（编号、容值、耐压）
- 电源供电方案（LDO、直接供电等）

【3. 时钟设计】
- 晶振频率：
- 晶振型号：
- 负载电容配置：

【4. 接口设计】
- MAC接口类型（RGMII/SGMII/MII/RMII）：
- MDI接口配置：
- 网络变压器型号：
- 匹配电阻值：

【5. 引脚连接】
请尽可能识别主芯片的关键引脚连接：
- 电源引脚及其连接
- 时钟引脚连接
- 数据引脚连接
- 控制引脚连接

【6. 其他元器件】
列出所有可识别的元器件：
- 电阻（编号和阻值）
- 电容（编号和容值）
- LED、二极管等
- 其他IC芯片

【7. 设计注释】
识别原理图上的所有文字注释和设计说明。

【8. 设计评估】
- 这个设计是否完整？
- 是否符合典型的PHY芯片应用设计？
- 有哪些关键的设计要点？

请尽可能详细、准确地提取信息。`

/**
 * 测试 Qwen3-VL-32B-Thinking
 */
async function testQwen3VL(imagePath) {
  console.log('\n' + '='.repeat(60))
  console.log('Qwen3-VL-32B-Thinking 原理图识别测试')
  console.log('='.repeat(60))
  console.log(`图片: ${imagePath}`)
  console.log(`模型: Qwen/Qwen3-VL-32B-Thinking`)
  console.log('='.repeat(60))

  // 读取图片
  const imageBuffer = fs.readFileSync(imagePath)
  const base64Image = imageBuffer.toString('base64')

  console.log(`\n图片大小: ${(base64Image.length / 1024).toFixed(2)} KB`)
  console.log('开始调用 Qwen3-VL-32B-Thinking...\n')

  try {
    const startTime = Date.now()

    const response = await client.chat.completions.create({
      model: 'Qwen/Qwen3-VL-32B-Thinking',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              },
            },
            {
              type: 'text',
              text: SCHEMATIC_ANALYSIS_PROMPT,
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.2,  // 低温度保证准确性
    })

    const endTime = Date.now()
    const result = response.choices[0]?.message?.content || ''

    console.log(`✅ 成功! (耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒)`)
    console.log('\n' + '='.repeat(60))
    console.log('识别结果:')
    console.log('='.repeat(60))
    console.log(result)
    console.log('='.repeat(60))

    // 保存结果
    const outputDir = './test-results'
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const basename = path.basename(imagePath, path.extname(imagePath))
    const outputFile = path.join(outputDir, `${basename}_qwen3vl_${timestamp}.txt`)

    const report = `Qwen3-VL-32B-Thinking 原理图分析报告
===================
图片: ${imagePath}
模型: Qwen/Qwen3-VL-32B-Thinking
分析时间: ${new Date().toLocaleString('zh-CN')}
耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒

识别结果:
${result}

---
模型信息:
- Qwen3-VL-32B-Thinking 是支持思维链推理的视觉语言模型
- 具有强大的图像理解和技术分析能力
`

    fs.writeFileSync(outputFile, report, 'utf-8')
    console.log(`\n✓ 分析报告已保存: ${outputFile}`)

    return { success: true, result, duration: endTime - startTime }

  } catch (error) {
    console.log(`\n❌ 失败: ${error.message}`)

    if (error.response) {
      console.log('HTTP状态码:', error.response.status)
      console.log('错误详情:', JSON.stringify(error.response.data, null, 2))
    }

    if (error.code) {
      console.log('错误代码:', error.code)
    }

    return { success: false, error: error.message }
  }
}

/**
 * 主函数
 */
async function main() {
  const imagePath = process.argv[2] || './Database/YT8522 SCH.png'

  if (!fs.existsSync(imagePath)) {
    console.error(`错误: 文件不存在: ${imagePath}`)
    console.log('\n用法: npm run test-qwen3-vl <图片路径>')
    process.exit(1)
  }

  const result = await testQwen3VL(imagePath)

  if (result.success) {
    console.log('\n' + '='.repeat(60))
    console.log('✅ 测试成功!')
    console.log('='.repeat(60))
    console.log(`耗时: ${(result.duration / 1000).toFixed(2)}秒`)
    console.log(`模型: Qwen3-VL-32B-Thinking`)
    console.log('\nQwen3-VL 成功识别了原理图内容！')
  } else {
    console.log('\n' + '='.repeat(60))
    console.log('❌ 测试失败')
    console.log('='.repeat(60))
    console.log(`错误: ${result.error}`)
  }
}

main().catch(console.error)
