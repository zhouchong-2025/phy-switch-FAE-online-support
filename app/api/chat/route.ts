import { NextRequest } from 'next/server'
import { answerQuestionStream } from '@/lib/rag'

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json()

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: '无效的请求参数' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // 创建流式响应
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 使用RAG系统流式回答问题
          for await (const chunk of answerQuestionStream(message, history || [])) {
            // 将chunk编码为SSE格式
            const data = `data: ${JSON.stringify(chunk)}\n\n`
            controller.enqueue(encoder.encode(data))
          }

          // 关闭流
          controller.close()
        } catch (error) {
          console.error('流式生成错误:', error)
          const errorChunk = {
            type: 'error',
            content: '生成回答时出现错误',
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`))
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
  } catch (error) {
    console.error('Chat API 错误:', error)
    return new Response(
      JSON.stringify({
        error: '服务器内部错误',
        details: error instanceof Error ? error.message : '未知错误'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
