'use client'

import { useState, useRef, useEffect } from 'react'
import MessageList from './MessageList'
import InputArea from './InputArea'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: string[]
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: '你好！我是裕太微PHY/Switch技术支持助手。我可以帮您解答关于裕太微产品的技术问题，支持文字和语音输入。请问有什么可以帮助您的？',
      timestamp: new Date(),
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleSendMessage = async (content: string, isVoice: boolean = false) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // 创建一个临时的助手消息用于流式更新
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, assistantMessage])

    // 创建新的AbortController
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      // 准备对话历史（排除欢迎消息，只发送最近的对话）
      const history = messages
        .filter(msg => msg.id !== '0') // 排除欢迎消息
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history, // 传递对话历史
        }),
        signal: abortController.signal, // 添加中止信号
      })

      // 检查HTTP错误状态
      if (!response.ok) {
        throw new Error(`服务器错误 (${response.status})`)
      }

      // 处理流式响应
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      let buffer = ''
      let accumulatedContent = ''
      let sources: string[] = []

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        // 解码数据块
        buffer += decoder.decode(value, { stream: true })

        // 处理SSE格式的数据（data: {...}\n\n）
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || '' // 保留不完整的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const chunk = JSON.parse(line.slice(6))

              if (chunk.type === 'content') {
                // 累积内容并实时更新UI
                accumulatedContent += chunk.content
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                )
              } else if (chunk.type === 'sources') {
                // 保存来源信息
                sources = chunk.sources || []
              } else if (chunk.type === 'done') {
                // 流式传输完成，添加来源信息
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantMessageId
                      ? { ...msg, sources }
                      : msg
                  )
                )
              } else if (chunk.type === 'error') {
                throw new Error(chunk.content || '生成回答时出现错误')
              }
            } catch (parseError) {
              console.error('解析SSE数据失败:', parseError)
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error)

      // 如果是用户主动中止，不显示错误
      if (error.name === 'AbortError') {
        console.log('用户停止了生成')
        return
      }

      let errorContent = '抱歉，处理您的请求时出现错误。'

      // 根据错误类型提供更友好的提示
      if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
        errorContent = '⚠️ 网络连接失败，请检查网络后重试。\n\n可能原因：\n• 网络不稳定\n• 防火墙阻止连接\n• API服务暂时不可用'
      } else if (error.message.includes('500')) {
        errorContent = '⚠️ 服务器处理出错，已自动重试。请稍后再试。\n\n如果问题持续，可能是：\n• API服务暂时过载\n• 网络连接不稳定'
      } else if (error.message.includes('timeout')) {
        errorContent = '⚠️ 请求超时，请稍后重试。\n\n建议：\n• 检查网络连接\n• 简化问题描述'
      }

      // 更新助手消息为错误内容
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: errorContent }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-primary-900/30 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">
      <MessageList messages={messages} isLoading={isLoading} />
      <InputArea
        onSendMessage={handleSendMessage}
        onStopGeneration={handleStopGeneration}
        disabled={isLoading}
        isGenerating={isLoading}
      />
    </div>
  )
}
