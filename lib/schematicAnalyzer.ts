/**
 * 原理图分析核心库
 * 基于 fae-review-test.js 的成功测试经验
 */

import OpenAI from 'openai'
import pdfParse from 'pdf-parse'

const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY!,
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
- [ ] PHY ID是否正确

## 6. 参考资料建议

建议客户查阅以下文档章节：
- [ ] Datasheet - Application Circuit
- [ ] Hardware Design Guide
- [ ] FAQ文档中的相关问题

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

export interface SchematicAnalysisResult {
  success: boolean
  chipModel?: string
  analysis?: string
  error?: string
  duration?: number
  method?: 'text' | 'vlm'
}

export interface FAEReviewResult {
  success: boolean
  review?: string
  error?: string
  duration?: number
  comparisonScore?: number
}

/**
 * 从PDF提取文本内容（用于参考设计）
 * 使用 pdf-parse 替代 pdfjs-dist，更适合 serverless 环境
 */
export async function extractPDFText(buffer: ArrayBuffer): Promise<string> {
  console.log('[PDF] 开始提取文本，buffer 大小:', buffer.byteLength)

  try {
    const data = await pdfParse(Buffer.from(buffer))
    console.log('[PDF] 提取成功，总页数:', data.numpages, '文本长度:', data.text.length)
    return data.text
  } catch (error: any) {
    console.error('[PDF] 提取失败:', error.message)
    throw new Error(`PDF 文本提取失败: ${error.message}`)
  }
}

/**
 * 使用LLM分析PDF文本提取的参考设计
 */
export async function analyzeReferenceText(
  pdfText: string
): Promise<SchematicAnalysisResult> {
  const startTime = Date.now()

  try {
    const response = await client.chat.completions.create({
      model: 'Qwen/Qwen2.5-72B-Instruct',
      messages: [
        {
          role: 'system',
          content: '你是资深的硬件工程师，擅长从原理图���本中提取设计信息。',
        },
        {
          role: 'user',
          content: `这是PHY芯片参考原理图的PDF文本内容。请分析并提取设计信息：

${pdfText}

${SCHEMATIC_ANALYSIS_PROMPT}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    })

    const analysis = response.choices[0]?.message?.content || ''
    const duration = Date.now() - startTime

    // 尝试提取芯片型号
    const chipModelMatch = analysis.match(/主芯片型号[：:]\s*([A-Z0-9]+)/i)
    const chipModel = chipModelMatch ? chipModelMatch[1] : undefined

    return {
      success: true,
      analysis,
      chipModel,
      duration,
      method: 'text',
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '分析失败',
      duration: Date.now() - startTime,
    }
  }
}

/**
 * 使用VLM分析原理图图片（用于客户设计）
 */
export async function analyzeSchematicWithVLM(
  base64Image: string
): Promise<SchematicAnalysisResult> {
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

    const analysis = response.choices[0]?.message?.content || ''
    const duration = Date.now() - startTime

    // 尝试提取芯片型号
    const chipModelMatch = analysis.match(/主芯片型号[：:]\s*([A-Z0-9]+)/i)
    const chipModel = chipModelMatch ? chipModelMatch[1] : undefined

    return {
      success: true,
      analysis,
      chipModel,
      duration,
      method: 'vlm',
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'VLM分析失败',
      duration: Date.now() - startTime,
    }
  }
}

/**
 * 生成FAE review报告
 */
export async function generateFAEReview(
  referenceAnalysis: string,
  customerAnalysis: string
): Promise<FAEReviewResult> {
  const startTime = Date.now()

  try {
    const response = await client.chat.completions.create({
      model: 'Qwen/Qwen2.5-72B-Instruct',
      messages: [
        {
          role: 'system',
          content:
            '你是资深的PHY芯片FAE工程师，拥有10年以上硬件设计和客户支持经验。你的review要专业、准确、实用。',
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

    const review = response.choices[0]?.message?.content || ''
    const duration = Date.now() - startTime

    // 尝试提取符合程度分数
    const scoreMatch = review.match(/符合程度[：:]?\s*(\d+)%/i)
    const comparisonScore = scoreMatch ? parseInt(scoreMatch[1]) : undefined

    return {
      success: true,
      review,
      duration,
      comparisonScore,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Review生成失败',
      duration: Date.now() - startTime,
    }
  }
}

/**
 * 智能分析策略：根据文件类型自动选择最佳方案
 */
export async function analyzeSchematicSmart(
  file: File
): Promise<SchematicAnalysisResult> {
  console.log('[分析] 文件类型:', file.type, '大小:', file.size)

  try {
    // PDF文件：优先使用文本提取
    if (file.type === 'application/pdf') {
      console.log('[分析] PDF 文件，尝试文本提取')
      const buffer = await file.arrayBuffer()
      const text = await extractPDFText(buffer)
      console.log('[分析] 提取文本长度:', text.length)

      // 如果提取到足够的文本（>1000字符），使用文本分析
      if (text.length > 1000) {
        console.log('[分析] 文本足够，使用文本分析')
        return analyzeReferenceText(text)
      }
      console.log('[分析] 文本不足，切换到 VLM')
    }

    // 图片文件或PDF文本不足：使用VLM
    console.log('[分析] 使用 VLM 分析')
    const buffer = await file.arrayBuffer()

    // 检查 Buffer 是否可用
    if (typeof Buffer === 'undefined') {
      throw new Error('Buffer 在当前环境中不可用，请检查 runtime 配置')
    }

    const base64 = Buffer.from(buffer).toString('base64')
    console.log('[分析] Base64 转换完成，长度:', base64.length)

    return analyzeSchematicWithVLM(base64)
  } catch (error: any) {
    console.error('[分析] 发生错误:', error)
    return {
      success: false,
      error: `分析失败: ${error.message}`,
      duration: 0,
    }
  }
}
