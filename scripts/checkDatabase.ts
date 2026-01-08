/**
 * 检查数据库中的文档分布
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

async function checkDatabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('缺少环境变量')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 查询总记录数
  const { count: totalCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })

  console.log(`数据库总记录数: ${totalCount}\n`)

  // 查询YT8512相关的记录
  const { data: yt8512Data, count: yt8512Count } = await supabase
    .from('documents')
    .select('id, metadata', { count: 'exact' })
    .ilike('metadata->>source', '%YT8512%')

  console.log(`YT8512相关记录: ${yt8512Count}条`)
  if (yt8512Data && yt8512Data.length > 0) {
    console.log('示例:', yt8512Data[0].metadata)
  }

  // 查询YT8522相关的记录
  const { count: yt8522Count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .ilike('metadata->>source', '%YT8522%')

  console.log(`YT8522相关记录: ${yt8522Count}条`)

  // 按文件统计
  const { data: allDocs } = await supabase
    .from('documents')
    .select('metadata')
    .limit(1000)

  if (allDocs) {
    const fileStats: Record<string, number> = {}
    allDocs.forEach((doc: any) => {
      const source = doc.metadata?.source || 'unknown'
      fileStats[source] = (fileStats[source] || 0) + 1
    })

    console.log('\n文件分布:')
    Object.entries(fileStats).sort((a, b) => b[1] - a[1]).forEach(([file, count]) => {
      console.log(`  ${file}: ${count}条`)
    })
  }
}

checkDatabase()
