import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// 获取Supabase客户端（懒加载）
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('缺少Supabase环境变量配置')
  }

  return createClient(supabaseUrl, supabaseKey)
}

// 获取OpenAI客户端（懒加载）
function getOpenAIClient() {
  const apiKey = process.env.SILICONFLOW_API_KEY

  if (!apiKey) {
    throw new Error('缺少SILICONFLOW_API_KEY环境变量')
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://api.siliconflow.cn/v1',
  })
}

export interface SearchResult {
  content: string
  source: string
  page: number
  similarity: number
}

/**
 * 生成文本的向量嵌入（带重试机制）
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient()

  const maxRetries = 3
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.embeddings.create({
        model: 'BAAI/bge-m3', // 硅基流动提供的多语言向量模型
        input: text,
      })

      return response.data[0].embedding
    } catch (error: any) {
      lastError = error
      console.error(`向量嵌入生成失败 (尝试 ${attempt}/${maxRetries}):`, error.message)

      // 如果是网络错误且还有重试机会，等待后重试
      if (attempt < maxRetries && (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET' || error.message.includes('Connection error'))) {
        const waitTime = attempt * 1000 // 递增等待时间: 1s, 2s
        console.log(`等待 ${waitTime}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }

      // 如果不是可重试的错误，或者已经是最后一次尝试，抛出错误
      throw error
    }
  }

  throw lastError
}

/**
 * 向量搜索相关文档（改进版：混合搜索）
 */
export async function searchDocuments(
  query: string,
  limit: number = 10 // 增加返回数量到10条
): Promise<SearchResult[]> {
  const supabase = getSupabaseClient()

  // 生成查询向量
  const queryEmbedding = await generateEmbedding(query)

  // 提取查询中的关键型号（YT8512, YT8522等）
  const modelNumbers: string[] = []

  // 1. 匹配完整格式：YT8522, YT8512等
  const fullMatches = query.match(/YT\d{3,4}[A-Z]*/gi) || []
  modelNumbers.push(...fullMatches.map(m => m.toUpperCase()))

  // 2. 匹配简写格式：8522, 8512等（4位数字，前后不能是数字）
  const shortMatches = query.match(/\b\d{4}\b/g) || []
  for (const match of shortMatches) {
    // 只处理85xx系列（裕太微PHY芯片的型号范围）
    if (match.startsWith('85')) {
      modelNumbers.push(`YT${match}`)
    }
  }

  const uniqueModels = [...new Set(modelNumbers)]
  console.log(`查询关键词:`, uniqueModels)

  // 检测是否是通用故障排除/调试问题
  const isGeneralTroubleshooting = /丢包|link不通|不通|连接失败|调试|排查|故障|debug|troubleshoot|issue|problem|error|fail/i.test(query)

  // 检测是否是选型/推荐类问题
  const isSelectionQuery = /推荐|选型|有哪些|什么型号|选择|适合|可以用|有没有|建议/i.test(query)

  // 如果查询包含多个型号，需要确保两者都被检索到
  if (uniqueModels.length > 1) {
    console.log('检测到对比查询，使用混合搜索策略')

    // 增加搜索数量，确保覆盖多个型号
    const extendedLimit = limit * 3 // 扩大3倍

    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.15, // 进一步降低阈值
      match_count: extendedLimit,
    })

    if (error) {
      console.error('向量搜索错误:', error)
      throw error
    }

    if (!data || data.length === 0) {
      return []
    }

    // 识别通用文档
    const generalDocs = data.filter((doc: SearchResult) =>
      /Q&A|Debug|Troubleshoot|FAQ|问答|调试|故障/i.test(doc.source)
    )

    // 分组：确保每个型号都有文档被选中
    const groupedByModel: Record<string, SearchResult[]> = {}

    data.forEach((doc: SearchResult) => {
      // 跳过通用文档，单独处理
      if (/Q&A|Debug|Troubleshoot|FAQ|问答|调试|故障/i.test(doc.source)) {
        return
      }

      uniqueModels.forEach(model => {
        if (doc.source.toUpperCase().includes(model.toUpperCase())) {
          if (!groupedByModel[model]) {
            groupedByModel[model] = []
          }
          groupedByModel[model].push(doc)
        }
      })
    })

    let balancedResults: SearchResult[]

    // 如果是通用故障排除问题且有通用文档，保留通用文档
    if (isGeneralTroubleshooting && generalDocs.length > 0) {
      console.log('检测到通用故障排除问题，保留通用文档')

      // 分配配额：30%通用文档 + 70%型号文档
      const generalQuota = Math.ceil(limit * 0.3)
      const modelQuota = limit - generalQuota
      const perModelLimit = Math.ceil(modelQuota / uniqueModels.length)

      const modelResults: SearchResult[] = []
      uniqueModels.forEach(model => {
        const modelDocs = groupedByModel[model] || []
        modelResults.push(...modelDocs.slice(0, perModelLimit))
      })

      balancedResults = [
        ...generalDocs.slice(0, generalQuota),
        ...modelResults
      ].slice(0, limit)

      console.log(`混合搜索结果: 找到 ${balancedResults.length} 个相关文档块`)
      console.log('文档分布: 通用文档', generalDocs.length, '个,',
        Object.entries(groupedByModel).map(([model, docs]) =>
          `${model}: ${docs.length}个`
        ).join(', '))
    } else {
      // 普通对比查询，按型号平衡分配
      const perModelLimit = Math.ceil(limit / uniqueModels.length)

      balancedResults = []
      uniqueModels.forEach(model => {
        const modelDocs = groupedByModel[model] || []
        balancedResults.push(...modelDocs.slice(0, perModelLimit))
      })

      balancedResults = balancedResults.slice(0, limit)

      console.log(`混合搜索结果: 找到 ${balancedResults.length} 个相关文档块`)
      console.log('型号分布:', Object.entries(groupedByModel).map(([model, docs]) =>
        `${model}: ${docs.length}个`
      ).join(', '))
    }

    return balancedResults
  }

  // 普通单一查询（但如果有明确型号，优先返回该型号的文档）
  if (uniqueModels.length === 1) {
    // 单一型号查询：扩大搜索范围，然后优先返回该型号的文档
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.2,
      match_count: limit * 3, // 扩大3倍以确保有足够的该型号文档
    })

    if (error) {
      console.error('向量搜索错误:', error)
      throw error
    }

    if (!data || data.length === 0) {
      console.log(`向量搜索结果: 找到 0 个相关文档块`)
      return []
    }

    // 将结果分为三组：目标型号的文档、通用文档、其他文档
    const targetModel = uniqueModels[0]
    const targetDocs = data.filter((doc: SearchResult) =>
      doc.source.toUpperCase().includes(targetModel.toUpperCase())
    )

    // 识别通用文档（Q&A, Debug, Troubleshooting等）
    const generalDocs = data.filter((doc: SearchResult) =>
      !doc.source.toUpperCase().includes(targetModel.toUpperCase()) &&
      /Q&A|Debug|Troubleshoot|FAQ|问答|调试|故障/i.test(doc.source)
    )

    const otherDocs = data.filter((doc: SearchResult) =>
      !doc.source.toUpperCase().includes(targetModel.toUpperCase()) &&
      !/Q&A|Debug|Troubleshoot|FAQ|问答|调试|故障/i.test(doc.source)
    )

    let results: SearchResult[]

    // 如果是通用故障排除问题，保留更多通用文档
    if (isGeneralTroubleshooting && generalDocs.length > 0) {
      console.log('检测到通用故障排除问题，保留通用文档')
      // 混合返回：50%通用文档 + 50%目标型号文档
      const generalQuota = Math.ceil(limit / 2)
      const targetQuota = limit - generalQuota

      results = [
        ...generalDocs.slice(0, generalQuota),
        ...targetDocs.slice(0, targetQuota),
        ...otherDocs.slice(0, Math.max(0, limit - generalDocs.length - targetDocs.length))
      ].slice(0, limit)

      console.log(`向量搜索结果: 找到 ${data.length} 个相关文档块`)
      console.log(`通用问题过滤: 通用文档 ${generalDocs.length}个, ${targetModel}文档 ${targetDocs.length}个, 其他文档 ${otherDocs.length}个, 返回 ${results.length}个`)
    } else {
      // 优先返回目标型号的文档，不足时补充通用文档和其他文档
      results = [
        ...targetDocs.slice(0, limit),
        ...generalDocs.slice(0, Math.max(0, limit - targetDocs.length)),
        ...otherDocs.slice(0, Math.max(0, limit - targetDocs.length - generalDocs.length))
      ].slice(0, limit)

      console.log(`向量搜索结果: 找到 ${data.length} 个相关文档块`)
      console.log(`型号过滤: ${targetModel}文档 ${targetDocs.length}个, 通用文档 ${generalDocs.length}个, 其他文档 ${otherDocs.length}个, 返回 ${results.length}个`)
    }

    return results
  }

  // 无明确型号的通用查询
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.2,
    match_count: isSelectionQuery ? limit * 3 : limit, // 选型问题扩大搜索范围
  })

  if (error) {
    console.error('向量搜索错误:', error)
    throw error
  }

  if (!data || data.length === 0) {
    console.log(`向量搜索结果: 找到 0 个相关文档块`)
    return []
  }

  // 如果是选型问题，优先返回Selection Guide文档
  if (isSelectionQuery) {
    console.log('检测到选型问题，优先返回Selection Guide文档')

    const selectionGuideDocs = data.filter((doc: SearchResult) =>
      /Selection\s*Guide|选型/i.test(doc.source)
    )

    const otherDocs = data.filter((doc: SearchResult) =>
      !/Selection\s*Guide|选型/i.test(doc.source)
    )

    // 优先返回Selection Guide，不足时补充其他文档
    const results = [
      ...selectionGuideDocs.slice(0, Math.ceil(limit * 0.6)), // 60%是Selection Guide
      ...otherDocs.slice(0, Math.ceil(limit * 0.4))
    ].slice(0, limit)

    console.log(`向量搜索结果: 找到 ${data.length} 个相关文档块`)
    console.log(`选型问题过滤: Selection Guide ${selectionGuideDocs.length}个, 其他文档 ${otherDocs.length}个, 返回 ${results.length}个`)

    return results
  }

  console.log(`向量搜索结果: 找到 ${data?.length || 0} 个相关文档块`)

  return data || []
}

/**
 * 将文档块存储到Supabase
 */
export async function storeDocumentChunk(
  content: string,
  metadata: { source: string; page: number; chunkIndex: number }
) {
  const supabase = getSupabaseClient()
  const embedding = await generateEmbedding(content)

  const { error } = await supabase.from('documents').insert({
    content,
    embedding,
    metadata,
  })

  if (error) {
    console.error('存储文档错误:', error)
    throw error
  }
}

/**
 * 批量存储文档
 */
export async function batchStoreDocuments(
  chunks: Array<{
    content: string
    metadata: { source: string; page: number; chunkIndex: number }
  }>
) {
  console.log(`开始批量存储 ${chunks.length} 个文档块...`)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    try {
      await storeDocumentChunk(chunk.content, chunk.metadata)
      if ((i + 1) % 10 === 0) {
        console.log(`进度: ${i + 1}/${chunks.length}`)
      }
    } catch (error) {
      console.error(`存储第 ${i + 1} 块失败:`, error)
    }
  }

  console.log('批量存储完成！')
}
