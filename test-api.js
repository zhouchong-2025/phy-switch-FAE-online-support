// 快速测试API连接的脚本
require('dotenv').config()

async function testAPIs() {
  console.log('=== 开始测试API连接 ===\n')

  // 1. 测试硅基流动API
  console.log('1. 测试硅基流动API...')
  try {
    const response = await fetch('https://api.siliconflow.cn/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.SILICONFLOW_API_KEY}`
      }
    })

    if (response.ok) {
      console.log('✅ 硅基流动API连接正常')
    } else {
      console.log(`❌ 硅基流动API返回错误: ${response.status} ${response.statusText}`)
      const text = await response.text()
      console.log('错误详情:', text)
    }
  } catch (error) {
    console.log('❌ 硅基流动API连接失败:', error.message)
  }

  console.log('')

  // 2. 测试Supabase连接
  console.log('2. 测试Supabase连接...')
  console.log(`   URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
  console.log(`   Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '已配置' : '未配置'}`)

  try {
    const { createClient } = require('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data, error } = await supabase
      .from('documents')
      .select('count')
      .limit(1)

    if (error) {
      console.log('❌ Supabase查询失败:', error.message)
      console.log('   错误详情:', JSON.stringify(error, null, 2))
    } else {
      console.log('✅ Supabase连接正常')

      // 检查文档数量
      const { count } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })

      console.log(`   数据库中有 ${count} 条文档记录`)

      if (count === 0) {
        console.log('⚠️  警告：数据库中没有文档，需要先运行 npm run init-db 初始化数据')
      }
    }
  } catch (error) {
    console.log('❌ Supabase连接失败:', error.message)
    console.log('   错误堆栈:', error.stack)
    console.log('   错误类型:', error.constructor.name)

    // 尝试直接fetch测试
    console.log('\n   尝试直接HTTP请求测试...')
    try {
      const testUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`
      const testResponse = await fetch(testUrl, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      })
      console.log(`   HTTP状态: ${testResponse.status}`)
    } catch (fetchError) {
      console.log('   HTTP请求也失败:', fetchError.message)
    }
  }

  console.log('\n=== 测试完成 ===')
}

testAPIs()
