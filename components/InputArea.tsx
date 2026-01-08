'use client'

import { useState, useRef } from 'react'

interface InputAreaProps {
  onSendMessage: (content: string, isVoice: boolean) => void
  onStopGeneration: () => void
  disabled: boolean
  isGenerating: boolean
}

export default function InputArea({ onSendMessage, onStopGeneration, disabled, isGenerating }: InputAreaProps) {
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false) // 新增：语音识别处理中
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !disabled) {
      onSendMessage(input, false)
      setInput('')
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,  // 回声消除
          noiseSuppression: true,  // 噪音抑制
          autoGainControl: true,   // 自动增益控制
        }
      })

      // 提升录音音质：使用opus编码器，比特率提升到128kbps
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000  // 从默认64kbps提升到128kbps
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        const formData = new FormData()
        formData.append('audio', audioBlob)

        // 开始处理语音识别
        setIsProcessing(true)

        try {
          const response = await fetch('/api/voice', {
            method: 'POST',
            body: formData,
          })

          const data = await response.json()
          if (data.text) {
            // 将识别的文字填入输入框，让用户可以修改后再发送
            setInput(data.text)
          } else if (data.error) {
            alert(`语音识别失败: ${data.error}`)
          }
        } catch (error) {
          console.error('语音识别失败:', error)
          alert('语音识别服务暂时不可用，请使用文字输入')
        } finally {
          // 识别完成，关闭处理状态
          setIsProcessing(false)
        }

        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('无法访问麦克风:', error)
      alert('无法访问麦克风，请检查权限设置')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  return (
    <div className="border-t border-primary-500/20 bg-primary-900/50 backdrop-blur-sm px-6 py-6">
      <form onSubmit={handleSubmit} className="flex items-center space-x-3">
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder={isProcessing ? "正在识别语音..." : "输入您的问题... (Shift+Enter 换行)"}
            disabled={disabled || isProcessing}
            className="w-full px-4 py-3 bg-white/5 border border-primary-500/30 rounded-xl text-white text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none backdrop-blur-sm leading-relaxed"
            rows={2}
          />
          {isProcessing && (
            <div className="absolute right-3 top-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={disabled || isProcessing}
          className={`p-4 rounded-xl transition-all ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-primary-600 hover:bg-primary-500'
          } text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
          title={isRecording ? '松开结束录音' : '按住说话'}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </button>

        {/* 停止生成按钮 */}
        {isGenerating && (
          <button
            type="button"
            onClick={onStopGeneration}
            className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors shadow-lg animate-pulse"
            title="停止生成"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* 发送按钮 */}
        <button
          type="submit"
          disabled={disabled || !input.trim() || isProcessing}
          className="p-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </form>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {isRecording ? (
            <span className="text-red-400">🎤 正在录音中...</span>
          ) : isProcessing ? (
            <span className="text-primary-300">⏳ 正在识别语音，请稍候...</span>
          ) : (
            '支持文字输入或按住麦克风按钮语音输入（识别后可编辑）'
          )}
        </div>
        <div className="text-xs text-gray-500">
          Teampo Intelligent v1.0
        </div>
      </div>
    </div>
  )
}
