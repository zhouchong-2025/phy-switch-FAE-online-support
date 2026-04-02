/**
 * PaddleOCR-VL-1.5 专用测试脚本
 * 尝试多种prompt和参数组合
 */

import 'dotenv/config'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { createCanvas, loadImage } from 'canvas'

const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
})

// 不同复杂度的prompt测试
const PROMPTS = {
  minimal: '请识别这张图片中的所有文字。',

  simple: '这是一张电路原理图。请识别图中的芯片型号、元器件标注和引脚名称。',

  structured: `请识别这张电路原理图中的以下信息：
1. 主芯片型号
2. 元器件编号和参数（如C18, R11等）
3. 引脚名称
4. 网络标签`,

  detailed: `这是YT8522 PHY芯片的应用原理图。请提取：
【芯片信息】主芯片型号和引脚连接
【电源】所有电源相关的电容和配置
【时钟】晶振频率和负载电容
【接口】MDI和MAC接口的元器件`
}

/**
 * 压缩图片到指定大小
 */
async function resizeImage(imagePath, maxWidth = 1024) {
  const img = await loadImage(imagePath)

  let width = img.width
  let height = img.height

  if (width > maxWidth) {
    height = Math.floor(height * (maxWidth / width))
    width = maxWidth
  }

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)

  return canvas.toBuffer('image/png').toString('base64')
}

/**
 * 测试PaddleOCR-VL-1.5
 */
async function testPaddleOCR(imagePath, promptKey = 'simple', useResize = false) {
  const prompt = PROMPTS[promptKey]

  console.log(`\n${'='.repeat(60)}`)
  console.log(`测试配置`)
  console.log(`${'='.repeat(60)}`)
  console.log(`图片: ${imagePath}`)
  console.log(`Prompt: ${promptKey}`)
  console.log(`图片压缩: ${useResize ? '是 (1024px)' : '否'}`)
  console.log(`${'='.repeat(60)}\n`)

  // 读取或压缩图片
  let base64Image
  if (useResize) {
    console.log('压缩图片中...')
    base64Image = await resizeImage(imagePath, 1024)
    console.log(`压缩后大小: ${(base64Image.length / 1024).toFixed(2)} KB`)
  } else {
    const imageBuffer = fs.readFileSync(imagePath)
    base64Image = imageBuffer.toString('base64')
    console.log(`原始大小: ${(base64Image.length / 1024).toFixed(2)} KB`)
  }

  console.log('\n开始调用PaddleOCR-VL-1.5...')

  try {
    const startTime = Date.now()

    const response = await client.chat.completions.create({
      model: 'PaddlePaddle/PaddleOCR-VL-1.5',
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
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 2048,
      temperature: 0.1,
    })

    const endTime = Date.now()
    const result = response.choices[0]?.message?.content || ''

    console.log(`\n✅ 成功! (耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒)`)
    console.log(`\n${'='.repeat(60)}`)
    console.log('识别结果:')
    console.log(`${'='.repeat(60)}`)
    console.log(result)
    console.log(`${'='.repeat(60)}`)

    return {
      success: true,
      promptKey,
      useResize,
      result,
      duration: endTime - startTime,
    }

  } catch (error) {
    console.log(`\n❌ 失败: ${error.message}`)

    if (error.response) {
      console.log('HTTP状态码:', error.response.status)
      console.log('错误详情:', error.response.data)
    }

    if (error.code) {
      console.log('错误代码:', error.code)
    }

    return {
      success: false,
      promptKey,
      useResize,
      error: error.message,
    }
  }
}

/**
 * 主测试流程
 */
async function main() {
  const imagePath = process.argv[2] || './Database/YT8522 SCH.png'

  console.log('\n' + '='.repeat(60))
  console.log('PaddleOCR-VL-1.5 多策略测试')
  console.log('='.repeat(60))

  if (!fs.existsSync(imagePath)) {
    console.error(`错误: 文件不存在: ${imagePath}`)
    process.exit(1)
  }

  const results = []

  // 测试1: 简单prompt + 原图
  console.log('\n【测试1】简单prompt + 原始图片')
  const test1 = await testPaddleOCR(imagePath, 'simple', false)
  results.push(test1)

  // 如果测试1失败，尝试压缩图片
  if (!test1.success) {
    console.log('\n【测试2】简单prompt + 压缩图片')
    const test2 = await testPaddleOCR(imagePath, 'simple', true)
    results.push(test2)
  }

  // 如果有成功的，尝试其他prompt
  const hasSuccess = results.some(r => r.success)
  if (hasSuccess) {
    console.log('\n【测试3】最小prompt')
    const test3 = await testPaddleOCR(imagePath, 'minimal', false)
    results.push(test3)

    console.log('\n【测试4】结构化prompt')
    const test4 = await testPaddleOCR(imagePath, 'structured', false)
    results.push(test4)
  }

  // 生成总结报告
  console.log('\n' + '='.repeat(60))
  console.log('测试总结')
  console.log('='.repeat(60))

  const successCount = results.filter(r => r.success).length
  console.log(`成功: ${successCount}/${results.length}`)

  if (successCount > 0) {
    console.log('\n✅ 成功的测试:')
    results.filter(r => r.success).forEach((r, i) => {
      console.log(`  ${i + 1}. Prompt: ${r.promptKey}, 压缩: ${r.useResize ? '是' : '否'}`)
    })

    // 保存最佳结果
    const bestResult = results.find(r => r.success)
    if (bestResult) {
      const outputDir = './test-results'
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const outputFile = path.join(outputDir, `paddleocr_success_${timestamp}.txt`)

      const report = `PaddleOCR-VL-1.5 成功识别报告
===================
图片: ${imagePath}
Prompt策略: ${bestResult.promptKey}
图片压缩: ${bestResult.useResize ? '是' : '否'}
耗时: ${(bestResult.duration / 1000).toFixed(2)}秒
识别时间: ${new Date().toLocaleString('zh-CN')}

识别结果:
${bestResult.result}

---
模型: PaddlePaddle/PaddleOCR-VL-1.5
`

      fs.writeFileSync(outputFile, report, 'utf-8')
      console.log(`\n✓ 结果已保存: ${outputFile}`)
    }
  } else {
    console.log('\n❌ 所有测试均失败')
    results.forEach((r, i) => {
      console.log(`  测试${i + 1}: ${r.error}`)
    })
  }
}

main().catch(console.error)
