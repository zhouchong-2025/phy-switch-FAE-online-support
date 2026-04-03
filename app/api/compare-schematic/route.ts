/**
 * 原理图对比review API端点
 * 使用 Server-Sent Events 流式返回进度
 */

import { NextRequest } from 'next/server'
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
  const encoder = new TextEncoder()

  // 辅助函数：发送进度更新
  const sendProgress = (
    controller: ReadableStreamDefaultController,
    step: number,
    totalSteps: number,
    message: string,
    data?: any
  ) => {
    const progress = {
      type: 'progress',
      step,
      totalSteps,
      message,
      percentage: Math.round((step / totalSteps) * 100),
      ...data,
    }
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`))
  }

  // 辅助函数：发送错误
  const sendError = (
    controller: ReadableStreamDefaultController,
    error: string
  ) => {
    const errorMsg = {
      type: 'error',
      error,
    }
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMsg)}\n\n`))
  }

  // 辅助函数：发送完成
  const sendComplete = (
    controller: ReadableStreamDefaultController,
    result: any
  ) => {
    const completeMsg = {
      type: 'complete',
      ...result,
    }
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify(completeMsg)}\n\n`)
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 验证输入
        const formData = await request.formData()
        const customerFile = formData.get('customerSchematic') as File
        const chipModel = formData.get('chipModel') as string

        if (!customerFile) {
          sendError(controller, '请上传客户原理图文件')
          controller.close()
          return
        }

        if (!chipModel) {
          sendError(controller, '请指定芯片型号')
          controller.close()
          return
        }

        // 验证支持的芯片型号
        const supportedChips = ['YT8522', 'YT8512']
        if (!supportedChips.includes(chipModel)) {
          sendError(
            controller,
            `暂不支持 ${chipModel}，当前支持的型号：${supportedChips.join(', ')}`
          )
          controller.close()
          return
        }

        // 验证文件类型
        const validTypes = [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
        ]
        if (!validTypes.includes(customerFile.type)) {
          sendError(controller, '仅支持PDF、PNG和JPG格式')
          controller.close()
          return
        }

        console.log(`FAE Review: ${chipModel}, 客户文件: ${customerFile.name}`)

        // Step 1/4: 查找参考设计文件
        sendProgress(controller, 1, 4, `正在查找 ${chipModel} 参考设计文件...`)

        const referenceFileNames = [
          `${chipModel}_REF_Schematic.pdf`, // YT8522 格式
          `${chipModel}_reference_design.pdf`, // YT8512 格式
        ]

        let referencePDFPath = ''
        for (const fileName of referenceFileNames) {
          const testPath = path.join(process.cwd(), 'Database', fileName)
          if (fs.existsSync(testPath)) {
            referencePDFPath = testPath
            console.log(`找到参考设计: ${fileName}`)
            break
          }
        }

        if (!referencePDFPath) {
          sendError(
            controller,
            `未找到${chipModel}的参考设计文件，请联系管理员`
          )
          controller.close()
          return
        }

        // Step 2/4: 分析参考设计
        sendProgress(controller, 2, 4, '正在分析官方参考设计...')

        const refBuffer = fs.readFileSync(referencePDFPath).buffer
        const refText = await extractPDFText(refBuffer)
        const refResult = await analyzeReferenceText(refText)

        if (!refResult.success) {
          sendError(controller, '参考设计分析失败: ' + refResult.error)
          controller.close()
          return
        }

        console.log(
          `参考设计分析完成，耗时 ${((refResult.duration || 0) / 1000).toFixed(1)}秒`
        )

        // Step 3/4: 分析客户设计
        sendProgress(
          controller,
          3,
          4,
          '正在分析客户设计（VLM识别中，预计1-2分钟）...'
        )

        const customerResult = await analyzeSchematicSmart(customerFile)

        if (!customerResult.success) {
          sendError(controller, '客户设计分析失败: ' + customerResult.error)
          controller.close()
          return
        }

        console.log(
          `客户设计分析完成，耗时 ${((customerResult.duration || 0) / 1000).toFixed(1)}秒`
        )

        // Step 4/4: 生成FAE review
        sendProgress(controller, 4, 4, '正在生成FAE专业建议...')

        const reviewResult = await generateFAEReview(
          refResult.analysis!,
          customerResult.analysis!
        )

        if (!reviewResult.success) {
          sendError(controller, 'Review生成失败: ' + reviewResult.error)
          controller.close()
          return
        }

        console.log(
          `Review生成完成，耗时 ${((reviewResult.duration || 0) / 1000).toFixed(1)}秒`
        )

        // 发送完整结果
        sendComplete(controller, {
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

        controller.close()
      } catch (error: any) {
        console.error('FAE review失败:', error)
        sendError(controller, error.message || '服务器内部错误')
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
