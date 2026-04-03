/**
 * 原理图对比review API端点
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeSchematicSmart,
  generateFAEReview,
  extractPDFText,
  analyzeReferenceText,
} from '@/lib/schematicAnalyzer'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 300 // Vercel Hobby计划最大允许300秒

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const customerFile = formData.get('customerSchematic') as File
    const chipModel = formData.get('chipModel') as string

    if (!customerFile) {
      return NextResponse.json(
        { error: '请上传客户原理图文件' },
        { status: 400 }
      )
    }

    if (!chipModel) {
      return NextResponse.json(
        { error: '请指定芯片型号' },
        { status: 400 }
      )
    }

    // 验证文件类型
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if (!validTypes.includes(customerFile.type)) {
      return NextResponse.json(
        { error: '仅支持PDF、PNG和JPG格式' },
        { status: 400 }
      )
    }

    console.log(
      `FAE Review: ${chipModel}, 客户文件: ${customerFile.name}`
    )

    // Step 1: 加载参考设计
    const referencePDFPath = path.join(
      process.cwd(),
      'Database',
      `${chipModel}_REF_Schematic.pdf`
    )

    if (!fs.existsSync(referencePDFPath)) {
      return NextResponse.json(
        { error: `未找到${chipModel}的参考设计文件` },
        { status: 404 }
      )
    }

    console.log('Step 1/3: 分析参考设计...')
    const refBuffer = fs.readFileSync(referencePDFPath).buffer
    const refText = await extractPDFText(refBuffer)
    const refResult = await analyzeReferenceText(refText)

    if (!refResult.success) {
      return NextResponse.json(
        { error: '参考设计分析失败: ' + refResult.error },
        { status: 500 }
      )
    }

    // Step 2: 分析客户设计
    console.log('Step 2/3: 分析客户设计...')
    const customerResult = await analyzeSchematicSmart(customerFile)

    if (!customerResult.success) {
      return NextResponse.json(
        { error: '客户设计分析失败: ' + customerResult.error },
        { status: 500 }
      )
    }

    // Step 3: 生成FAE review
    console.log('Step 3/3: 生成FAE review...')
    const reviewResult = await generateFAEReview(
      refResult.analysis!,
      customerResult.analysis!
    )

    if (!reviewResult.success) {
      return NextResponse.json(
        { error: 'Review生成失败: ' + reviewResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      review: reviewResult.review,
      comparisonScore: reviewResult.comparisonScore,
      referenceAnalysis: refResult.analysis,
      customerAnalysis: customerResult.analysis,
      durations: {
        reference: refResult.duration,
        customer: customerResult.duration,
        review: reviewResult.duration,
        total:
          (refResult.duration || 0) +
          (customerResult.duration || 0) +
          (reviewResult.duration || 0),
      },
      methods: {
        reference: refResult.method,
        customer: customerResult.method,
      },
    })
  } catch (error: any) {
    console.error('FAE review失败:', error)
    return NextResponse.json(
      { error: error.message || '服务器内部错误' },
      { status: 500 }
    )
  }
}
