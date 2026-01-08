import OpenAI from 'openai'
import { searchDocuments } from './vectorStore'

// 使用硅基流动的千问模型
const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY!,
  baseURL: 'https://api.siliconflow.cn/v1',
})

const SYSTEM_PROMPT = `你是一位资深以太网 PHY/switch 技术支持工程师，仅依据以下提供的官方文档片段作答。
若文档未提及，请明确回答"根据现有资料无法确认"，禁止编造。

**重要术语对应**：
- "商规" = "消费级"（如YT8531C中的C表示消费级/商规）
- "工业级" = "工业级"（如YT8531H中的H表示工业级）
- "千兆" = "GE" 或 "1GE"
- "百兆" = "FE" 或 "100M"
- **"车规" = "AEC-Q100" = "Automotive" = "汽车电子认证"**
  - AEC-Q100是汽车电子委员会制定的车规标准
  - 任何标注"AEC-Q100"或"Automotive"的芯片都是车规芯片
  - Grade 2: -40°C to +105°C (商用车规)
  - Grade 1: -40°C to +125°C (工业车规)

**关键概念区分**：
- **TX（传输接口）** = 指MAC接口类型的PHY芯片，如SGMII/RGMII/MII/RMII接口
  - 示例: YT8522A（车规百兆MII/RMII PHY）、YT8531（千兆RGMII PHY）
  - 用于连接MAC和外部网络，通过RJ45或光模块
- **T1（100BASE-T1）** = 车载以太网标准，使用单对双绞线
  - 示例: YT8010A（车规百兆T1 PHY）、YT8011A（车规千兆T1 PHY）
  - 专门用于汽车内部网络，与TX完全不同

回答要求：
1. 用简洁中文分点回答，必要时引用寄存器地址/位域
2. **引用文档时请直接说明文档名称**（如"根据YT8522 Datasheet..."），不要使用【文档1】【文档2】这样的编号
3. **对于对比类问题（如"YT8512和YT8522的区别"）**：
   - 优先从硬件层面对比：端口数、封装、MDIO地址、时钟要求、功耗、引脚定义等
   - 然后对比软件/配置层面：接口模式、寄存器差异、特殊配置等
   - 最后给出是否可以硬件兼容的明确结论
   - 如果文档中有对比表格，请总结关键差异点
4. **对于选型推荐问题**：
   - 明确列出符合条件的所有型号
   - 说明每个型号的关键特性（速率、等级、封装、认证）
   - **如果问车规产品，必须推荐带AEC-Q100/Automotive标注的型号**
5. **特别注意TX与T1的区分**：
   - 当用户问"TX PHY"时，推荐SGMII/RGMII/MII接口的芯片（如YT8522A、YT8531等）
   - 当用户问"T1 PHY"时，推荐100BASE-T1标准的芯片（如YT8010A、YT8011A等）
   - 绝对不要将TX和T1混淆！
6. **车规认证理解**：
   - 看到"AEC-Q100"或"Automotive"字样，就是车规芯片
   - YT8522A带有"Automotive Application AEC-Q100"标注，就是车规百兆TX PHY`

export interface ChatResponse {
  response: string
  sources: string[]
}

export interface StreamChunk {
  type: 'content' | 'sources' | 'done'
  content?: string
  sources?: string[]
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * 扩展查询关键词（术语同义词映射）
 */
function expandQueryTerms(question: string): string {
  let expandedQuery = question

  // 商规 -> 添加"消费级"同义词
  if (/商规/i.test(question)) {
    expandedQuery += ' 消费级'
  }

  // 千兆 -> 添加"GE"同义词
  if (/千兆/i.test(question)) {
    expandedQuery += ' GE 1GE'
  }

  // 百兆 -> 添加"FE"同义词
  if (/百兆/i.test(question)) {
    expandedQuery += ' FE 100M'
  }

  // pin 2 pin / 引脚兼容 -> 添加硬件兼容性相关术语
  if (/pin\s*2?\s*pin|引脚兼容|硬件兼容/i.test(question)) {
    expandedQuery += ' 引脚 封装 package pin 硬件兼容 替换'
  }

  // 时钟 -> 添加英文术语和相关概念
  if (/时钟|晶振|晶体|频率/i.test(question)) {
    expandedQuery += ' clock crystal oscillator CLKIN XTAL frequency 频率 晶振'
  }

  // 电源 -> 添加英文术语
  if (/电源|供电|上电/i.test(question)) {
    expandedQuery += ' power supply VDD voltage 电压'
  }

  // 复位 -> 添加英文术语
  if (/复位|重启/i.test(question)) {
    expandedQuery += ' reset RST NRST'
  }

  // 车规/车载 -> 添加英文术语
  if (/车规|车载|汽车/i.test(question)) {
    expandedQuery += ' Automotive AEC-Q100 车规 车载'
  }

  // TX -> 添加MAC接口术语（与T1区分）
  if (/\bTX\b/i.test(question) && !/\bT1\b/i.test(question)) {
    // TX指的是MAC接口（SGMII/RGMII/MII）的PHY
    expandedQuery += ' SGMII RGMII MII MAC interface 传输接口 TX接口'
  }

  // T1 -> 添加车载以太网术语（仅当不是排除T1的情况）
  if (/\bT1\b/i.test(question) && !/不是.*T1|非T1|排除.*T1/i.test(question)) {
    expandedQuery += ' 100BASE-T1 automotive ethernet'
  }

  return expandedQuery
}

/**
 * 从文本中提取芯片型号
 */
function extractModelNumbers(text: string): string[] {
  const results: string[] = []

  // 1. 匹配完整格式：YT8522, YT8512等
  const fullMatches = text.match(/YT\d{3,4}[A-Z]*/gi) || []
  results.push(...fullMatches.map(m => m.toUpperCase()))

  // 2. 匹配简写格式：8522, 8512等（4位数字，使用word boundary）
  const shortMatches = text.match(/\b\d{4}\b/g) || []
  for (const match of shortMatches) {
    // 只处理85xx系列（裕太微PHY芯片的型号范围）
    if (match.startsWith('85')) {
      results.push(`YT${match}`)
    }
  }

  return [...new Set(results)]
}

/**
 * 处理用户问题，基于RAG返回答案
 */
export async function answerQuestion(
  question: string,
  history: HistoryMessage[] = []
): Promise<ChatResponse> {
  console.log('收到用户问题:', question)

  // 检测是否是选型/推荐类问题
  const isSelectionQuery = /推荐|选型|有哪些|什么型号|选择|适合|可以用|有没有|建议/i.test(question)

  // 提取当前问题中的型号
  let modelNumbers = extractModelNumbers(question)

  // 如果当前问题没有型号，且不是选型问题，从历史中提取（最近3条）
  if (modelNumbers.length === 0 && history.length > 0 && !isSelectionQuery) {
    console.log('当前问题无型号，从历史中提取...')
    const recentHistory = history.slice(-6) // 最近3轮对话（6条消息）

    for (const msg of recentHistory) {
      const historicalModels = extractModelNumbers(msg.content)
      modelNumbers.push(...historicalModels)
    }

    modelNumbers = [...new Set(modelNumbers)] // 去重

    // TX vs T1 冲突检测：如果用户问TX，排除T1芯片
    const askingForTX = /\bTX\b/i.test(question) && !/\bT1\b/i.test(question)
    const askingForT1 = /\bT1\b/i.test(question) && !/\bTX\b/i.test(question)

    if (askingForTX || askingForT1) {
      // T1芯片型号列表
      const t1Chips = ['YT8010A', 'YT8010AN', 'YT8011A', 'YT8011AN', 'YT8011AR']

      if (askingForTX) {
        // 用户问TX，排除T1芯片
        const filteredModels = modelNumbers.filter(m => !t1Chips.includes(m.toUpperCase()))
        if (filteredModels.length < modelNumbers.length) {
          console.log(`检测到TX查询，过滤T1芯片: ${modelNumbers.join(',')} -> ${filteredModels.join(',')}`)
          modelNumbers = filteredModels
        }
      } else if (askingForT1) {
        // 用户问T1，只保留T1芯片（如果有）
        const t1Models = modelNumbers.filter(m => t1Chips.includes(m.toUpperCase()))
        if (t1Models.length > 0) {
          console.log(`检测到T1查询，只保留T1芯片: ${modelNumbers.join(',')} -> ${t1Models.join(',')}`)
          modelNumbers = t1Models
        }
      }
    }

    if (modelNumbers.length > 0) {
      console.log('从历史中提取到型号:', modelNumbers)
      // 扩展查询：将历史型号添加到查询中
      question = `${modelNumbers.join('和')} ${question}`
      console.log('扩展后的查询:', question)
    }
  } else if (isSelectionQuery) {
    console.log('检测到选型问题，不从历史提取型号')
  }

  // 扩展查询术语（商规->消费级，千兆->GE等）
  const expandedQuestion = expandQueryTerms(question)
  if (expandedQuestion !== question) {
    console.log('术语扩展后的查询:', expandedQuestion)
  }

  // 1. 检索相关文档（减少到6个，提升速度）
  const searchResults = await searchDocuments(expandedQuestion, 6)

  console.log(`检索到 ${searchResults.length} 个相关文档块`)
  if (searchResults.length > 0) {
    console.log('相似度分布:', searchResults.map(r =>
      `${r.source.substring(0, 20)}... (${(r.similarity * 100).toFixed(1)}%)`
    ))
  }

  // 车规查询增强：如果问题包含车规相关关键词，且结果中没有Product Selection Guide，则强制添加
  const isAutomotiveQuery = /车规|automotive|AEC-Q100|车载/i.test(question)
  const hasProductGuide = searchResults.some(r => r.source.includes('Product Selection Guide'))

  if (isAutomotiveQuery && !hasProductGuide) {
    console.log('检测到车规查询，但缺少Product Selection Guide，正在补充...')

    // 直接搜索Product Selection Guide中包含Automotive的内容（减少到8个）
    const automotiveQuery = modelNumbers.length > 0
      ? `${modelNumbers.join(' ')} Automotive AEC-Q100 车规`
      : 'Automotive AEC-Q100 车规'

    const additionalResults = await searchDocuments(automotiveQuery, 8)
    const productGuideResults = additionalResults.filter(r =>
      r.source.includes('Product Selection Guide') &&
      (r.content.includes('Automotive') || r.content.includes('AEC-Q100') || r.content.includes('车规'))
    )

    if (productGuideResults.length > 0) {
      console.log(`补充了 ${productGuideResults.length} 个Product Selection Guide车规相关文档`)
      // 将Product Selection Guide结果插入到前2位（减少补充数量）
      searchResults.splice(2, 0, ...productGuideResults.slice(0, 1))
    }
  }

  if (searchResults.length === 0) {
    return {
      response: '抱歉，我在知识库中没有找到相关信息。请尝试换一个问题或联系技术支持人员。',
      sources: [],
    }
  }

  // 2. 构建上下文
  const retrievedChunks = searchResults
    .map(
      (result, idx) =>
        `[文档${idx + 1}] 来源: ${result.source} (第${result.page}页)\n${result.content}`
    )
    .join('\n\n---\n\n')

  // 3. 构建对话消息（包含历史）
  const messages: any[] = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    }
  ]

  // 添加历史消息（最近3轮）
  if (history.length > 0) {
    const recentHistory = history.slice(-6) // 最近3轮对话
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content,
      })
    })
  }

  // 添加当前问题和检索到的文档
  messages.push({
    role: 'user',
    content: `【文档片段】\n${retrievedChunks}\n\n【用户问题】\n${question}`,
  })

  // 4. 调用千问模型生成回答
  const response = await client.chat.completions.create({
    model: 'Qwen/Qwen3-30B-A3B-Instruct-2507', // 千问模型
    messages,
    temperature: 0.3, // 降低温度，减少编造
    max_tokens: 800, // 优化到800，平衡速度和质量
    top_p: 0.9, // 添加top_p采样，提升生成速度
  })

  const answer = response.choices[0].message.content || '无法生成回答'

  // 5. 提取引用来源并合并同一文档的多个引用
  const sourceMap = new Map<string, Set<number>>()

  searchResults.forEach((r) => {
    if (!sourceMap.has(r.source)) {
      sourceMap.set(r.source, new Set())
    }
    sourceMap.get(r.source)!.add(r.page)
  })

  const sources = Array.from(sourceMap.entries()).map(([source, pagesSet]) => {
    // 排序页码
    const pages = Array.from(pagesSet).sort((a, b) => a - b)

    // 格式化页码显示
    let pageDisplay: string
    if (pages.length === 1) {
      pageDisplay = `第${pages[0]}页`
    } else if (pages.length <= 3) {
      pageDisplay = `第${pages.join(',')}页`
    } else {
      // 超过3个页码，显示范围
      pageDisplay = `第${pages[0]},${pages[1]},...,${pages[pages.length - 1]}页 (共${pages.length}处)`
    }

    return `${source} (${pageDisplay})`
  })

  return {
    response: answer,
    sources,
  }
}

/**
 * 流式处理用户问题，基于RAG返回答案流
 */
export async function* answerQuestionStream(
  question: string,
  history: HistoryMessage[] = []
): AsyncGenerator<StreamChunk> {
  console.log('收到用户问题（流式）:', question)

  // 检测是否是选型/推荐类问题
  const isSelectionQuery = /推荐|选型|有哪些|什么型号|选择|适合|可以用|有没有|建议/i.test(question)

  // 提取当前问题中的型号
  let modelNumbers = extractModelNumbers(question)

  // 如果当前问题没有型号，且不是选型问题，从历史中提取（最近3条）
  if (modelNumbers.length === 0 && history.length > 0 && !isSelectionQuery) {
    console.log('当前问题无型号，从历史中提取...')
    const recentHistory = history.slice(-6) // 最近3轮对话（6条消息）

    for (const msg of recentHistory) {
      const historicalModels = extractModelNumbers(msg.content)
      modelNumbers.push(...historicalModels)
    }

    modelNumbers = [...new Set(modelNumbers)] // 去重

    // TX vs T1 冲突检测：如果用户问TX，排除T1芯片
    const askingForTX = /\bTX\b/i.test(question) && !/\bT1\b/i.test(question)
    const askingForT1 = /\bT1\b/i.test(question) && !/\bTX\b/i.test(question)

    if (askingForTX || askingForT1) {
      // T1芯片型号列表
      const t1Chips = ['YT8010A', 'YT8010AN', 'YT8011A', 'YT8011AN', 'YT8011AR']

      if (askingForTX) {
        // 用户问TX，排除T1芯片
        const filteredModels = modelNumbers.filter(m => !t1Chips.includes(m.toUpperCase()))
        if (filteredModels.length < modelNumbers.length) {
          console.log(`检测到TX查询，过滤T1芯片: ${modelNumbers.join(',')} -> ${filteredModels.join(',')}`)
          modelNumbers = filteredModels
        }
      } else if (askingForT1) {
        // 用户问T1，只保留T1芯片（如果有）
        const t1Models = modelNumbers.filter(m => t1Chips.includes(m.toUpperCase()))
        if (t1Models.length > 0) {
          console.log(`检测到T1查询，只保留T1芯片: ${modelNumbers.join(',')} -> ${t1Models.join(',')}`)
          modelNumbers = t1Models
        }
      }
    }

    if (modelNumbers.length > 0) {
      console.log('从历史中提取到型号:', modelNumbers)
      // 扩展查询：将历史型号添加到查询中
      question = `${modelNumbers.join('和')} ${question}`
      console.log('扩展后的查询:', question)
    }
  } else if (isSelectionQuery) {
    console.log('检测到选型问题，不从历史提取型号')
  }

  // 扩展查询术语（商规->消费级，千兆->GE等）
  const expandedQuestion = expandQueryTerms(question)
  if (expandedQuestion !== question) {
    console.log('术语扩展后的查询:', expandedQuestion)
  }

  // 1. 检索相关文档（减少到6个，提升速度）
  const searchResults = await searchDocuments(expandedQuestion, 6)

  console.log(`检索到 ${searchResults.length} 个相关文档块`)
  if (searchResults.length > 0) {
    console.log('相似度分布:', searchResults.map(r =>
      `${r.source.substring(0, 20)}... (${(r.similarity * 100).toFixed(1)}%)`
    ))
  }

  // 车规查询增强：如果问题包含车规相关关键词，且结果中没有Product Selection Guide，则强制添加
  const isAutomotiveQuery = /车规|automotive|AEC-Q100|车载/i.test(question)
  const hasProductGuide = searchResults.some(r => r.source.includes('Product Selection Guide'))

  if (isAutomotiveQuery && !hasProductGuide) {
    console.log('检测到车规查询，但缺少Product Selection Guide，正在补充...')

    // 直接搜索Product Selection Guide中包含Automotive的内容（减少到8个）
    const automotiveQuery = modelNumbers.length > 0
      ? `${modelNumbers.join(' ')} Automotive AEC-Q100 车规`
      : 'Automotive AEC-Q100 车规'

    const additionalResults = await searchDocuments(automotiveQuery, 8)
    const productGuideResults = additionalResults.filter(r =>
      r.source.includes('Product Selection Guide') &&
      (r.content.includes('Automotive') || r.content.includes('AEC-Q100') || r.content.includes('车规'))
    )

    if (productGuideResults.length > 0) {
      console.log(`补充了 ${productGuideResults.length} 个Product Selection Guide车规相关文档`)
      // 将Product Selection Guide结果插入到前2位（减少补充数量）
      searchResults.splice(2, 0, ...productGuideResults.slice(0, 1))
    }
  }

  if (searchResults.length === 0) {
    yield {
      type: 'content',
      content: '抱歉，我在知识库中没有找到相关信息。请尝试换一个问题或联系技术支持人员。',
    }
    yield { type: 'sources', sources: [] }
    yield { type: 'done' }
    return
  }

  // 2. 构建上下文
  const retrievedChunks = searchResults
    .map(
      (result, idx) =>
        `[文档${idx + 1}] 来源: ${result.source} (第${result.page}页)\n${result.content}`
    )
    .join('\n\n---\n\n')

  // 3. 构建对话消息（包含历史）
  const messages: any[] = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    }
  ]

  // 添加历史消息（最近3轮）
  if (history.length > 0) {
    const recentHistory = history.slice(-6) // 最近3轮对话
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content,
      })
    })
  }

  // 添加当前问题和检索到的文档
  messages.push({
    role: 'user',
    content: `【文档片段】\n${retrievedChunks}\n\n【用户问题】\n${question}`,
  })

  // 4. 调用千问模型生成回答（流式）
  const stream = await client.chat.completions.create({
    model: 'Qwen/Qwen3-30B-A3B-Instruct-2507', // 千问模型
    messages,
    temperature: 0.3, // 降低温度，减少编造
    max_tokens: 800, // 优化到800，平衡速度和质量
    top_p: 0.9, // 添加top_p采样，提升生成速度
    stream: true, // 启用流式输出
  })

  // 5. 流式输出内容
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content
    if (content) {
      yield {
        type: 'content',
        content,
      }
    }
  }

  // 6. 提取引用来源并合并同一文档的多个引用
  const sourceMap = new Map<string, Set<number>>()

  searchResults.forEach((r) => {
    if (!sourceMap.has(r.source)) {
      sourceMap.set(r.source, new Set())
    }
    sourceMap.get(r.source)!.add(r.page)
  })

  const sources = Array.from(sourceMap.entries()).map(([source, pagesSet]) => {
    // 排序页码
    const pages = Array.from(pagesSet).sort((a, b) => a - b)

    // 格式化页码显示
    let pageDisplay: string
    if (pages.length === 1) {
      pageDisplay = `第${pages[0]}页`
    } else if (pages.length <= 3) {
      pageDisplay = `第${pages.join(',')}页`
    } else {
      // 超过3个页码，显示范围
      pageDisplay = `第${pages[0]},${pages[1]},...,${pages[pages.length - 1]}页 (共${pages.length}处)`
    }

    return `${source} (${pageDisplay})`
  })

  // 7. 发送来源信息
  yield { type: 'sources', sources }

  // 8. 标记完成
  yield { type: 'done' }
}
