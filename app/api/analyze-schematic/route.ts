/**
 * 原理图分析API端点
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyzeSchematicSmart } from '@/lib/schematicAnalyzer'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5分钟超时（VLM分析需要较长时间）

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('schematic') as File

    if (!file) {
      return NextResponse.json(
        { error: '请上传原理图文件' },
        { status: 400 }
      )
    }

    // 验证文件类型
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '仅支持PDF、PNG和JPG格式' },
        { status: 400 }
      )
    }

    // 验证文件大小（最大10MB）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: '文件大小不能超过10MB' },
        { status: 400 }
      )
    }

    console.log(`分析原理图: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)

    // 智能分析
    const result = await analyzeSchematicSmart(file)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '分析失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      chipModel: result.chipModel,
      duration: result.duration,
      method: result.method,
      fileName: file.name,
      fileSize: file.size,
    })
  } catch (error: any) {
    console.error('原理图分析失败:', error)
    return NextResponse.json(
      { error: error.message || '服务器内部错误' },
      { status: 500 }
    )
  }
}
