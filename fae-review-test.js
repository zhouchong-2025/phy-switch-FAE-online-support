/**
 * FAE Review 测试：对比参考原理图和客户原理图
 *
 * 策略：
 * - 参考设计：使用文本提取（PDF原生文本层，快速准确）
 * - 客户设计：使用VLM分析（图片，深度理解）
 */

import 'dotenv/config'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
})

// PDF worker 配置
pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs'

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

const FAE_REVIEW_PROMPT = `你是一位资深的PHY芯片FAE工程师，负责帮助客户review硬件设计。

现在你需要对比官方参考设计和客户设计，给出专业的FAE review建议。

请按照以下结构生成review报告：

## 1. 设计对比总结
- 客户设计与参考设计的符合程度（0-100%）
- 主要差异点列表
- 总体评估（优秀/良好/一般/需改进）

## 2. 关键设计点逐项对比

### 2.1 电源设计对比
**参考设计**：[提取参考设计的电源配置]
**客户设计**：[提取客户设计的电源配置]
**评估**：
- ✓ 符合datasheet要求的点
- ⚠️ 需要注意的点
- ❌ 明显错误的点

### 2.2 时钟设计对比
**参考设计**：[晶振配置]
**客户设计**：[晶振配置]
**评估**：
- 负载电容是否匹配
- 晶振选型是否合理

### 2.3 MDI接口设计对比
**参考设计**：[MDI配置]
**客户设计**：[MDI配置]
**评估**：
- 阻抗匹配是否正确
- ESD保护是否充分

### 2.4 MAC接口设计对比
**参考设计**：[MAC接口]
**客户设计**：[MAC接口]
**评估**：
- 接口配置是否正确
- 信号完整性是否考虑

## 3. 潜在问题诊断

### 3.1 电源问题
- [ ] 去耦电容容值不足
- [ ] 去耦电容位置可能不当
- [ ] 缺少必要的电源轨
- [ ] 其他：___

### 3.2 时钟问题
- [ ] 负载电容不匹配
- [ ] 晶振频率错误
- [ ] PCB布线可能有问题

### 3.3 信号完整性问题
- [ ] 差分信号可能不匹配
- [ ] 阻抗可能不连续
- [ ] EMI风险

## 4. FAE优化建议

### 4.1 必须修改的问题（Critical）⚠️
[列出必须立即修改的关键问题，如果没有就说"无关键问题"]

### 4.2 强烈建议优化的点（High Priority）
[列出建议优化的重要问题]

### 4.3 可选的改进建议（Low Priority）
[列出可选的优化建议]

## 5. 调试检查清单

如果客户报告"PHY不工作"，建议按以下顺序检查：

### 5.1 电源检查
- [ ] 测量所有电源轨电压是否正常
- [ ] 检查电源上电时序
- [ ] 示波器检查电源纹波

### 5.2 时钟检查
- [ ] 示波器测量晶振是否起振
- [ ] 检查晶振频率是否准确（25MHz）
- [ ] 检查晶振幅度是否足够

### 5.3 复位检查
- [ ] 测量复位信号时序
- [ ] 确认复位脉冲宽度符合要求

### 5.4 接口检查
- [ ] MDIO接口通信是否正常
- [ ] 寄存器是否可读写
- [ ] PHY ID是否正确（YT8522）

## 6. 参考资料建议

建议客户查阅以下文档章节：
- [ ] YT8522 Datasheet - Application Circuit
- [ ] YT8522 Hardware Design Guide
- [ ] FAQ文档中的PHY调试问题

## 7. 总体评分

- **设计完整性**：_/10
- **电源设计**：_/10
- **时钟设计**：_/10
- **接口设计**：_/10
- **可靠性**：_/10

**总体评估**：[优秀/良好/一般/需改进] - [一句话总结]

请给出实用、具体、可执行的FAE建议。特别注意：
1. 如果客户设计与参考设计基本一致，应该明确指出"设计符合参考设计要求"
2. 只标记真正存在的问题，不要臆测
3. 建议要具体可操作`

/**
 * 从PDF提取文本内容
 */
async function extractPDFText(pdfPath) {
  console.log(`正在从PDF提取文本: ${path.basename(pdfPath)}`)

  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const pdf = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise

  let fullText = ''

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((item) => item.str).join(' ')
    fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`
  }

  console.log(`✓ PDF文本提取完成 (${fullText.length} 字符, ${pdf.numPages} 页)`)

  return fullText
}

/**
 * 使用VLM分析原理图图片
 */
async function analyzeSchematicWithVLM(imagePath) {
  console.log(`开始VLM分析: ${path.basename(imagePath)}`)

  const imageBuffer = fs.readFileSync(imagePath)
  const base64Image = imageBuffer.toString('base64')

  console.log(`图片大小: ${(base64Image.length / 1024).toFixed(2)} KB`)

  const startTime = Date.now()

  try {
    const response = await client.chat.completions.create({
      model: 'Qwen/Qwen3-VL-32B-Thinking',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
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
      temperature: 0.2,
    })

    const endTime = Date.now()
    const result = response.choices[0]?.message?.content || ''

    console.log(`✓ VLM分析完成 (耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒)`)

    return {
      success: true,
      result,
      duration: endTime - startTime,
    }
  } catch (error) {
    console.error(`✗ VLM分析失败: ${error.message}`)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 使用LLM分析PDF文本提取的参考设计
 */
async function analyzeReferenceText(pdfText) {
  console.log('使用LLM分析参考设计文本...')

  const startTime = Date.now()

  try {
    const response = await client.chat.completions.create({
      model: 'Qwen/Qwen2.5-72B-Instruct',
      messages: [
        {
          role: 'system',
          content: '你是资深的硬件工程师，擅长从原理图文本中提取设计信息。',
        },
        {
          role: 'user',
          content: `这是YT8522参考原理图的PDF文本内容。请分析并提取设计信息：

${pdfText}

${SCHEMATIC_ANALYSIS_PROMPT}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    })

    const endTime = Date.now()
    const result = response.choices[0]?.message?.content || ''

    console.log(`✓ 参考设计分析完成 (耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒)`)

    return {
      success: true,
      result,
      duration: endTime - startTime,
    }
  } catch (error) {
    console.error(`✗ 参考设计分析失败: ${error.message}`)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 生成FAE review报告
 */
async function generateFAEReview(referenceAnalysis, customerAnalysis) {
  console.log('\n开始生成FAE review报告...')

  const startTime = Date.now()

  try {
    const response = await client.chat.completions.create({
      model: 'Qwen/Qwen2.5-72B-Instruct',
      messages: [
        {
          role: 'system',
          content: '你是资深的PHY芯片FAE工程师，拥有10年以上硬件设计和客户支持经验。你的review要专业、准确、实用。',
        },
        {
          role: 'user',
          content: `
## 官方参考设计分析结果

${referenceAnalysis}

---

## 客户设计分析结果

${customerAnalysis}

---

${FAE_REVIEW_PROMPT}
          `,
        },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    })

    const endTime = Date.now()
    const review = response.choices[0]?.message?.content || ''

    console.log(`✓ FAE review生成完成 (耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒)`)

    return {
      success: true,
      review,
      duration: endTime - startTime,
    }
  } catch (error) {
    console.error(`✗ FAE review生成失败: ${error.message}`)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('\n' + '='.repeat(80))
  console.log('FAE Review 测试：对比参考原理图和客户原理图')
  console.log('='.repeat(80))

  const referencePDF = './Database/YT8522_REF_Schematic.pdf'
  const customerImage = './Database/YT8522 SCH.png'

  // 检查文件
  if (!fs.existsSync(referencePDF)) {
    console.error(`错误: 参考原理图不存在: ${referencePDF}`)
    process.exit(1)
  }

  if (!fs.existsSync(customerImage)) {
    console.error(`错误: 客户原理图不存在: ${customerImage}`)
    process.exit(1)
  }

  const totalStartTime = Date.now()

  // Step 1: 分析参考设计（使用文本提取）
  console.log('\n' + '='.repeat(80))
  console.log('Step 1/3: 分析官方参考设计（文本提取方式）')
  console.log('='.repeat(80))

  const pdfText = await extractPDFText(referencePDF)
  const referenceResult = await analyzeReferenceText(pdfText)

  if (!referenceResult.success) {
    console.error('参考设计分析失败，终止测试')
    process.exit(1)
  }

  // Step 2: 分析客户设计（使用VLM）
  console.log('\n' + '='.repeat(80))
  console.log('Step 2/3: 分析客户设计（VLM视觉分析）')
  console.log('='.repeat(80))

  const customerResult = await analyzeSchematicWithVLM(customerImage)
  if (!customerResult.success) {
    console.error('客户设计分析失败，终止测试')
    process.exit(1)
  }

  // Step 3: 生成FAE review
  console.log('\n' + '='.repeat(80))
  console.log('Step 3/3: 生成FAE Review报告')
  console.log('='.repeat(80))

  const reviewResult = await generateFAEReview(
    referenceResult.result,
    customerResult.result
  )

  if (!reviewResult.success) {
    console.error('FAE review生成失败')
    process.exit(1)
  }

  const totalEndTime = Date.now()

  // 显示结果
  console.log('\n' + '='.repeat(80))
  console.log('FAE Review 报告')
  console.log('='.repeat(80))
  console.log(reviewResult.review)
  console.log('='.repeat(80))

  // 保存结果
  const outputDir = './test-results'
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const outputFile = path.join(outputDir, `fae_review_${timestamp}.txt`)

  const report = `YT8522 FAE Review 报告
${'='.repeat(80)}

测试时间: ${new Date().toLocaleString('zh-CN')}
总耗时: ${((totalEndTime - totalStartTime) / 1000).toFixed(2)}秒

分析策略:
- 参考设计: PDF文本提取 + LLM分析 (快速准确)
- 客户设计: VLM视觉分析 (深度理解)

## 参考设计分析
文件: ${referencePDF}
方法: 文本提取 (${pdfText.length} 字符)
耗时: ${(referenceResult.duration / 1000).toFixed(2)}秒

${referenceResult.result}

${'='.repeat(80)}

## 客户设计分析
文件: ${customerImage}
方法: VLM (Qwen3-VL-32B-Thinking)
耗时: ${(customerResult.duration / 1000).toFixed(2)}秒

${customerResult.result}

${'='.repeat(80)}

## FAE Review 报告
耗时: ${(reviewResult.duration / 1000).toFixed(2)}秒

${reviewResult.review}

${'='.repeat(80)}

工具链:
- PDF文本提取: pdfjs-dist
- 参考设计分析: Qwen2.5-72B-Instruct
- 客户设计分析: Qwen3-VL-32B-Thinking
- Review生成: Qwen2.5-72B-Instruct
`

  fs.writeFileSync(outputFile, report, 'utf-8')

  console.log('\n' + '='.repeat(80))
  console.log('✓ 测试完成!')
  console.log('='.repeat(80))
  console.log(`参考设计分析: ${(referenceResult.duration / 1000).toFixed(2)}秒 (文本方式)`)
  console.log(`客户设计分析: ${(customerResult.duration / 1000).toFixed(2)}秒 (VLM方式)`)
  console.log(`Review生成: ${(reviewResult.duration / 1000).toFixed(2)}秒`)
  console.log(`总耗时: ${((totalEndTime - totalStartTime) / 1000).toFixed(2)}秒`)
  console.log(`\n报告已保存: ${outputFile}`)
}

main().catch(console.error)
