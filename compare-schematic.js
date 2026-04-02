/**
 * 原理图对比分析工具（基于文本）
 * 对比客户原理图与参考设计，给出FAE级优化建议
 */

import 'dotenv/config'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

// 配置PDF.js worker
const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
const workerUrl = `file:///${workerPath.replace(/\\/g, '/')}`
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: 'https://api.siliconflow.cn/v1',
})

/**
 * 从PDF提取文本
 */
async function extractPDFText(pdfPath, pageNum = 2) {
  const dataBuffer = fs.readFileSync(pdfPath)

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(dataBuffer),
    useSystemFonts: true,
  })

  const pdfDocument = await loadingTask.promise
  const page = await pdfDocument.getPage(pageNum)
  const textContent = await page.getTextContent()
  const textItems = textContent.items
  const text = textItems.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim()

  return text
}

/**
 * FAE级原理图对比分析
 */
async function compareSchematicDesigns(referenceInfo, customerInfo) {
  const prompt = `你是一位资深的PHY芯片FAE工程师，请对比分析客户的原理图设计与官方参考设计。

【官方参考设计】
${referenceInfo}

【客户设计】
${customerInfo}

请按以下框架进行专业的FAE级分析：

## 1. 设计对比总结

### 1.1 一致性评估
- 与参考设计的符合程度：
- 主要差异点：

### 1.2 芯片型号确认
- 客户使用的芯片：
- 是否为参考设计的目标芯片：

## 2. 关键设计点分析

### 2.1 电源设计
**参考设计**：
- 电源轨配置：
- 去耦电容方案：

**客户设计**：
- 电源轨配置：
- 去耦电容方案：

**评估**：
- ✓ 符合datasheet要求的点：
- ⚠️ 需要注意的点：
- ❌ 明显错误的点：

### 2.2 时钟设计
**参考设计**：
- 晶振频率和负载电容：

**客户设计**：
- 晶振频率和负载电容：

**评估**：
- 负载电容是否匹配：
- 晶振选型是否合理：

### 2.3 MDI接口设计
**参考设计**：
- 网络变压器型号：
- 匹配电阻配置：

**客户设计**：
- 网络变压器型号：
- 匹配电阻配置：

**评估**：
- 阻抗匹配是否正确：
- ESD保护是否充分：

### 2.4 MAC接口设计
**参考设计**：
- 接口类型（RGMII/SGMII/MII）：

**客户设计**：
- 接口类型：

**评估**：
- 接口配置是否正确：

## 3. 潜在问题诊断

### 3.1 电源问题
- [ ] 去耦电容容值不足
- [ ] 去耦电容位置不当
- [ ] 缺少必要的电源轨
- [ ] 其他：

### 3.2 时钟问题
- [ ] 负载电容不匹配
- [ ] 晶振频率错误
- [ ] PCB布线问题
- [ ] 其他：

### 3.3 信号完整性问题
- [ ] 差分信号不匹配
- [ ] 阻抗不连续
- [ ] EMI风险
- [ ] 其他：

## 4. FAE优化建议

### 4.1 必须修改的问题（Critical）
1.
2.

### 4.2 强烈建议优化的点（High Priority）
1.
2.

### 4.3 可选的改进建议（Low Priority）
1.
2.

## 5. 调试检查清单

如果客户报告"PHY不工作"，建议按以下顺序检查：

### 5.1 电源检查
- [ ] 测量所有电源轨电压是否正常
- [ ] 检查电源上电时序
- [ ] 示波器检查电源纹波

### 5.2 时钟检查
- [ ] 示波器测量晶振是否起振
- [ ] 检查晶振频率是否准确
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
- [ ] YT8522 Datasheet - Application Circuit (第X页)
- [ ] Hardware Design Guide
- [ ] FAQ文档中的相关问题

## 7. 总体评分

- 设计完整性：□/10
- 电源设计：□/10
- 时钟设计：□/10
- 接口设计：□/10
- 可靠性：□/10

**总体评估**：
□ 优秀 - 完全符合参考设计
□ 良好 - 有小问题但不影响功能
□ 一般 - 有明显问题需要修改
□ 较差 - 存在严重设计缺陷

---

请给出专业、详细、可操作的分析报告。`

  try {
    console.log('\n正在调用Qwen2.5-72B-Instruct进行深度分析...')
    const startTime = Date.now()

    const response = await client.chat.completions.create({
      model: 'Qwen/Qwen2.5-72B-Instruct',  // 使用72B最强文本模型
      messages: [
        {
          role: 'system',
          content: '你是一位拥有20年经验的资深PHY芯片FAE工程师，擅长原理图审查和问题诊断。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,  // 低温度，确保专业准确
      max_tokens: 4096,  // 足够长的输出
    })

    const endTime = Date.now()
    const analysis = response.choices[0]?.message?.content || ''

    console.log(`✓ 分析完成 (耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒)`)

    return analysis
  } catch (error) {
    console.error('分析失败:', error.message)
    throw error
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
原理图对比分析工具（基于文本）

用法:
  npm run compare-schematic [参考设计PDF] [客户信息文件]

参数:
  参考设计PDF    - 官方参考原理图PDF路径（可选，默认YT8522）
  客户信息文件   - 客户原理图关键信息（txt格式）

示例:
  npm run compare-schematic
  npm run compare-schematic ./Database/YT8522_REF_Schematic.pdf ./customer_design.txt

客户信息文件格式示例（customer_design.txt）：
---
芯片型号：YT8522
晶振：25MHz，负载电容22pF
去耦电容：
  - AVDD33: C1=10uF/16V, C2=100nF/16V
  - DVDDLO: C3=1uF/16V, C4=100nF/16V
网络变压器：H1102NL
匹配电阻：R1=75Ω, R2=75Ω
MAC接口：RGMII
其他：（补充任何相关信息）
---
    `)
    process.exit(0)
  }

  const refPdfPath = args[0] || './Database/YT8522_REF_Schematic.pdf'
  const customerInfoPath = args[1] || './customer_design.txt'

  console.log('='.repeat(60))
  console.log('原理图对比分析工具（基于文本）')
  console.log('='.repeat(60))
  console.log(`参考设计: ${refPdfPath}`)
  console.log(`客户设计: ${customerInfoPath}`)
  console.log('='.repeat(60))

  try {
    // 1. 提取参考设计信息
    console.log('\n[1/3] 提取参考设计信息...')
    const referenceInfo = await extractPDFText(refPdfPath, 2)
    console.log(`✓ 提取完成 (${referenceInfo.length}字符)`)

    // 2. 读取客户设计信息
    console.log('\n[2/3] 读取客户设计信息...')
    if (!fs.existsSync(customerInfoPath)) {
      console.error(`\n错误: 客户信息文件不存在: ${customerInfoPath}`)
      console.log('\n请创建客户信息文件，格式示例：')
      console.log(`
芯片型号：YT8522
晶振：25MHz，负载电容22pF
去耦电容：
  - AVDD33: C1=10uF/16V, C2=100nF/16V
  - DVDDLO: C3=1uF/16V, C4=100nF/16V
网络变压器：H1102NL
匹配电阻：R1=75Ω, R2=75Ω
MAC接口：RGMII
      `)
      process.exit(1)
    }

    const customerInfo = fs.readFileSync(customerInfoPath, 'utf-8')
    console.log(`✓ 读取完成 (${customerInfo.length}字符)`)

    // 3. 对比分析
    console.log('\n[3/3] 进行FAE级对比分析...')
    const analysis = await compareSchematicDesigns(referenceInfo, customerInfo)

    // 输出结果
    console.log('\n' + '='.repeat(60))
    console.log('FAE分析报告:')
    console.log('='.repeat(60))
    console.log(analysis)
    console.log('='.repeat(60))

    // 保存结果
    const outputDir = './test-results'
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const outputFile = path.join(outputDir, `schematic_comparison_${timestamp}.txt`)

    const report = `原理图对比分析报告
===================
参考设计: ${refPdfPath}
客户设计: ${customerInfoPath}
分析时间: ${new Date().toLocaleString('zh-CN')}
分析模型: Qwen2.5-72B-Instruct

${analysis}

---
工具: 基于文本的原理图对比分析
模型: Qwen2.5-72B-Instruct (硅基流动)
`

    fs.writeFileSync(outputFile, report, 'utf-8')
    console.log(`\n✓ 分析报告已保存: ${outputFile}`)

  } catch (error) {
    console.error('\n❌ 错误:', error.message)
    process.exit(1)
  }
}

main()
