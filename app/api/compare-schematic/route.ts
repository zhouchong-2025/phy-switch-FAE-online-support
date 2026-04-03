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
import { promises as fsPromises } from 'fs'
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

    // 创建SSE流式响应
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送进度更新的辅助函数
          const sendProgress = (step: number, message: string, progress: number) => {
            const data = `data: ${JSON.stringify({
              type: 'progress',
              step,
              message,
              progress,
            })}\n\n`
            controller.enqueue(encoder.encode(data))
          }

          const sendError = (errorMessage: string) => {
            const data = `data: ${JSON.stringify({
              type: 'error',
              error: errorMessage,
            })}\n\n`
            controller.enqueue(encoder.encode(data))
          }

          // Step 1: 加载参考设计（优先使用缓存）
          sendProgress(1, '正在加载参考设计...', 10)

          const cachePath = path.join(process.cwd(), 'cache', `${chipModel}_ref_analysis.json`)
          let refResult

          try {
            // 异步检查缓存是否存在
            await fsPromises.access(cachePath)
            console.log('Step 1/3: 从缓存加载参考设计...')

            // 异步读取缓存
            const cachedData = await fsPromises.readFile(cachePath, 'utf-8')
            const cached = JSON.parse(cachedData)

            refResult = {
              success: true,
              analysis: cached.analysis,
              duration: 0,
              method: 'cached' as const,
            }
            console.log(`  ✓ 缓存命中，缓存时间: ${cached.cachedAt}`)
            sendProgress(1, '✓ 参考设计加载完成（缓存）', 20)
          } catch (cacheError) {
            // 缓存不存在或读取失败，使用原始PDF
            console.log('Step 1/3: 分析参考设计（无缓存）...')
            sendProgress(1, '正在分析参考设计（首次加载需90秒）...', 10)

            // 根据芯片型号确定参考设计文件名（不同芯片文件名格式不同）
            const referenceFileMap: Record<string, string> = {
              'YT8522': 'YT8522_REF_Schematic.pdf',
              'YT8512': 'YT8512_reference_design.pdf',
            }

            const referenceFileName = referenceFileMap[chipModel]
            if (!referenceFileName) {
              sendError(`不支持的芯片型号: ${chipModel}`)
              controller.close()
              return
            }

            const referencePDFPath = path.join(
              process.cwd(),
              'Database',
              referenceFileName
            )

            try {
              // 异步检查PDF是否存在
              await fsPromises.access(referencePDFPath)
            } catch {
              sendError(`未找到${chipModel}的参考设计文件（期望路径: ${referenceFileName}）`)
              controller.close()
              return
            }

            // 异步读取PDF
            const refBuffer = await fsPromises.readFile(referencePDFPath)
            const refText = await extractPDFText(refBuffer.buffer)
            refResult = await analyzeReferenceText(refText)

            if (!refResult.success) {
              sendError('参考设计分析失败: ' + refResult.error)
              controller.close()
              return
            }
            sendProgress(1, '✓ 参考设计分析完成', 20)
          }

          // Step 2: 分析客户设��
          console.log('Step 2/3: 分析客户设计...')
          sendProgress(2, '正在分析客户设计（VLM视觉识别中，约需105秒）...', 30)

          const customerResult = await analyzeSchematicSmart(customerFile)

          if (!customerResult.success) {
            sendError('客户设计分析失败: ' + customerResult.error)
            controller.close()
            return
          }

          sendProgress(2, '✓ 客户设计分析完成', 60)

          // Step 3: 生成FAE review
          console.log('Step 3/3: 生成FAE review...')
          sendProgress(3, '正在生成FAE Review报告（约需95秒）...', 70)

          const reviewResult = await generateFAEReview(
            refResult.analysis!,
            customerResult.analysis!
          )

          if (!reviewResult.success) {
            sendError('Review生成失败: ' + reviewResult.error)
            controller.close()
            return
          }

          sendProgress(3, '✓ Review报告生成完成', 95)

          // 发送完整结果
          const completeData = `data: ${JSON.stringify({
            type: 'complete',
            result: {
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
            },
          })}\n\n`
          controller.enqueue(encoder.encode(completeData))
          controller.close()
        } catch (error: any) {
          console.error('FAE review失败:', error)
          const errorData = `data: ${JSON.stringify({
            type: 'error',
            error: error.message || '服务器内部错误',
          })}\n\n`
          controller.enqueue(encoder.encode(errorData))
          controller.close()
        }
      },
    })

    // 返回SSE流
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('FAE review初始化失败:', error)
    return NextResponse.json(
      { error: error.message || '服务器内部错误' },
      { status: 500 }
    )
  }
}
