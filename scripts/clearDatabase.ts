/**
 * 清空documents表中的所有数据
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// 加载环境变量
dotenv.config()

async function clearDatabase() {
  console.log('=== 清空向量数据库 ===\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('缺少Supabase环境变量配置')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 查询当前记录数
  const { count: beforeCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })

  console.log(`当前数据库中有 ${beforeCount} 条记录`)

  if (beforeCount === 0) {
    console.log('数据库已经是空的，无需清空')
    return
  }

  console.log('开始删除所有记录...')

  // 删除所有记录
  const { error } = await supabase
    .from('documents')
    .delete()
    .neq('id', 0) // 删除所有id不等于0的记录（即所有记录）

  if (error) {
    console.error('删除失败:', error)
    throw error
  }

  // 验证删除结果
  const { count: afterCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })

  console.log(`删除完成！剩余记录数: ${afterCount}`)
  console.log('\n✅ 数据库已清空，可以重新运行 npm run init-db')
}

// 执行清空
clearDatabase().catch((error) => {
  console.error('清空失败:', error)
  process.exit(1)
})
