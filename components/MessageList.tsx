'use client'

import { useEffect, useRef } from 'react'
import { Message } from './ChatInterface'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
}

// 检测内容是否包含表格（对比格式）
function hasTableContent(content: string): boolean {
  // 检测常见的表格标记
  return (
    content.includes('|') && content.includes('---') || // Markdown表格
    content.includes('对比') ||
    content.includes('| YT') ||
    /\|\s*\*\*/.test(content) // 表格标题格式
  )
}

// 渲染消息内容（支持表格横向滚动）
function renderMessageContent(content: string) {
  const hasTable = hasTableContent(content)

  if (hasTable) {
    return (
      <div className="table-container">
        <div className="overflow-x-auto -mx-2 px-2" ref={(el) => {
          if (el) {
            // 检查是否真的需要滚动
            const needsScroll = el.scrollWidth > el.clientWidth
            const hint = el.nextElementSibling as HTMLElement
            if (hint && hint.classList.contains('scroll-hint')) {
              hint.style.display = needsScroll ? 'flex' : 'none'
            }
          }
        }}>
          <div className="min-w-max">
            <div className="whitespace-pre-wrap text-base leading-relaxed font-mono text-sm">
              {content}
            </div>
          </div>
        </div>
        <div className="scroll-hint text-xs text-primary-300 mt-2 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          <span>左右滑动查看完整表格</span>
        </div>
      </div>
    )
  }

  return (
    <div className="whitespace-pre-wrap break-words text-base leading-relaxed">
      {content}
    </div>
  )
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()

    // 检查所有表格容器是否需要滚动提示
    const checkScrollHints = () => {
      const containers = document.querySelectorAll('.overflow-x-auto')
      containers.forEach(container => {
        const el = container as HTMLElement
        const needsScroll = el.scrollWidth > el.clientWidth
        const hint = el.nextElementSibling as HTMLElement
        if (hint && hint.classList.contains('scroll-hint')) {
          hint.style.display = needsScroll ? 'flex' : 'none'
        }
      })
    }

    // 延迟检查，确保内容已渲染
    setTimeout(checkScrollHints, 100)

    // 监听窗口大小变化
    window.addEventListener('resize', checkScrollHints)
    return () => window.removeEventListener('resize', checkScrollHints)
  }, [messages, isLoading])

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`w-full max-w-[95%] sm:max-w-[85%] md:max-w-[75%] lg:max-w-[70%] rounded-2xl px-4 sm:px-6 py-4 shadow-lg ${
              message.role === 'user'
                ? 'bg-primary-600 text-white'
                : 'bg-white/10 text-gray-100 backdrop-blur-md border border-primary-400/20'
            }`}
          >
            <div className="prose prose-invert max-w-none">
              {renderMessageContent(message.content)}
            </div>
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-primary-400/30">
                <div className="text-xs text-primary-200 mb-1">参考来源：</div>
                <div className="text-xs space-y-1">
                  {message.sources.map((source, idx) => {
                    // 从source字符串中提取文件名（格式: "文件名.pdf (第X页, 相似度: XX%)"）
                    const fileNameMatch = source.match(/^(.+?\.pdf)/)
                    const fileName = fileNameMatch ? fileNameMatch[1] : source
                    const downloadUrl = `/docs/${encodeURIComponent(fileName)}`

                    return (
                      <div key={idx} className="text-primary-300">
                        📄{' '}
                        <a
                          href={downloadUrl}
                          download={fileName}
                          className="hover:text-primary-200 hover:underline cursor-pointer transition-colors"
                          title={`点击下载 ${fileName}`}
                        >
                          {source}
                        </a>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="text-xs text-gray-400 mt-2" suppressHydrationWarning>
              {message.timestamp.toLocaleTimeString('zh-CN')}
            </div>
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-white/10 backdrop-blur-md border border-primary-400/20 rounded-2xl px-6 py-4">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
