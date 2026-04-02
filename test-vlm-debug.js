/**
 * 简化版VLM测试 - 用于调试API调用
 */

import 'dotenv/config'
import OpenAI from 'openai'
import fs from 'fs'

const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
})

async function testVLM() {
  const imagePath = process.argv[2] || './Database/YT8522 SCH.png'

  console.log('读取图片:', imagePath)
  const imageBuffer = fs.readFileSync(imagePath)
  const base64Image = imageBuffer.toString('base64')

  console.log('图片大小:', (base64Image.length / 1024).toFixed(2), 'KB')
  console.log('Base64前100字符:', base64Image.substring(0, 100))

  // 测试不同的模型
  const models = [
    'Qwen/Qwen-VL-Plus',
    'Pro/Qwen/Qwen2-VL-72B-Instruct',
    'Qwen2-VL-7B-Instruct',
  ]

  for (const model of models) {
    console.log('\n' + '='.repeat(60))
    console.log(`测试模型: ${model}`)
    console.log('='.repeat(60))

    try {
      const response = await client.chat.completions.create({
        model,
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
                text: '请识别这张图片中的主要内容。',
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      })

      const result = response.choices[0]?.message?.content
      console.log('✓ 成功!')
      console.log('结果:', result.substring(0, 200))
      break  // 成功后退出

    } catch (error) {
      console.log(`❌ 失败: ${error.message}`)
      if (error.response) {
        console.log('状态码:', error.response.status)
        console.log('响应体:', JSON.stringify(error.response.data, null, 2))
      }
      if (error.code) {
        console.log('错误码:', error.code)
      }
    }
  }
}

testVLM().catch(console.error)
