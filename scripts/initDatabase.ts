/**
 * 数据初始化脚本
 * 用于解析Database文件夹中的PDF并存储到Supabase
 */

import dotenv from 'dotenv'
import path from 'path'
import { parseAllPDFs, saveChunksToJSON } from '../lib/pdfParser'
import { batchStoreDocuments } from '../lib/vectorStore'

// 加载环境变量
dotenv.config()

async function initializeDatabase() {
  console.log('=== 开始初始化数据库 ===\n')

  const databasePath = path.join(process.cwd(), 'Database')
  const outputPath = path.join(process.cwd(), 'data', 'parsed_chunks.json')

  // 1. 解析所有PDF文件
  console.log('步骤 1: 解析PDF文件')
  const chunks = await parseAllPDFs(databasePath)

  // 2. 保存到JSON（备份）
  console.log('\n步骤 2: 保存解析结果')
  saveChunksToJSON(chunks, outputPath)

  // 3. 存储到Supabase向量数据库
  console.log('\n步骤 3: 存储到向量数据库')
  await batchStoreDocuments(chunks)

  console.log('\n=== 初始化完成 ===')
}

// 执行初始化
initializeDatabase().catch((error) => {
  console.error('初始化失败:', error)
  process.exit(1)
})
