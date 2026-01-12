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
  const [retryCount, setRetryCount] = useState(0) // 重试次数
  const [recordingTime, setRecordingTime] = useState(0) // 录音时长（秒）
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const maxRecordingTime = 30 // 最大录音时长30秒

  // 语音识别重试函数
  const recognizeVoice = async (formData: FormData, attempt: number = 1): Promise<any> => {
    const maxRetries = 3
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000) // 缩短到25秒超时（音频已优化）

    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return await response.json()
    } catch (error: any) {
      clearTimeout(timeoutId)

      // 网络错误且还有重试次数
      if (attempt < maxRetries && (error.name === 'AbortError' || error.message.includes('fetch'))) {
        console.log(`语音识别失败，正在重试 (${attempt}/${maxRetries})...`)
        setRetryCount(attempt)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // 递增延迟：1s, 2s, 3s
        return recognizeVoice(formData, attempt + 1)
      }

      throw error
    }
  }

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
          sampleRate: 16000,       // 降低采样率到16kHz（语音识别足够）
        }
      })

      // 优化录音参数：降低比特率到24kbps，减小文件大小，加快传输
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 24000  // 从128kbps降到24kbps（语音识别足够）
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      setRecordingTime(0)

      // 启动录音计时器
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          // 达到最大时长自动停止
          if (newTime >= maxRecordingTime) {
            stopRecording()
          }
          return newTime
        })
      }, 1000)

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        // 清除计时器
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        console.log('录音完成:', {
          duration: `${recordingTime}秒`,
          size: `${(audioBlob.size / 1024).toFixed(2)}KB`,
        })

        const formData = new FormData()
        formData.append('audio', audioBlob)

        // 开始处理语音识别
        setIsProcessing(true)
        setRetryCount(0) // 重置重试计数

        try {
          const data = await recognizeVoice(formData)

          if (data.text) {
            // 将识别的文字填入输入框，让用户可以修改后再发送
            setInput(data.text)
          } else if (data.error) {
            alert(`语音识别失败: ${data.error}`)
          }
        } catch (error: any) {
          console.error('语音识别最终失败:', error)

          // 区分超时错误和其他错误
          if (error.name === 'AbortError') {
            alert('语音识别超时，请检查网络连接后重试\n建议：\n1. 录制较短的语音（10秒内）\n2. 如持续失败，请使用文字输入')
          } else {
            alert('语音识别服务暂时不可用，请使用文字输入')
          }
        } finally {
          // 识别完成，关闭处理状态
          setIsProcessing(false)
          setRetryCount(0) // 重置重试计数
          setRecordingTime(0) // 重置录音时长
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

      // 清除计时器
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  // 点击切换录音状态
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
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
            placeholder={
              isProcessing
                ? retryCount > 0
                  ? `正在重试识别 (${retryCount}/3)...`
                  : "正在识别语音，请稍候..."
                : "输入您的问题... (Shift+Enter 换行)"
            }
            disabled={disabled || isProcessing}
            className="w-full px-4 py-3 bg-white/5 border border-primary-500/30 rounded-xl text-white text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none backdrop-blur-sm leading-relaxed"
            rows={2}
          />
          {isProcessing && (
            <div className="absolute right-3 top-3 flex items-center gap-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              {retryCount > 0 && (
                <span className="text-xs text-yellow-400">
                  重试 {retryCount}/3
                </span>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={toggleRecording}
          disabled={disabled || isProcessing}
          className={`relative p-4 rounded-xl transition-all ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-primary-600 hover:bg-primary-500'
          } text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
          title={isRecording ? '点击结束录音' : '点击开始录音'}
        >
          {isRecording && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              {recordingTime}秒 / {maxRecordingTime}秒
            </div>
          )}
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
            <span className="text-red-400">
              🎤 正在录音中... ({recordingTime}秒 / 最长{maxRecordingTime}秒)
            </span>
          ) : isProcessing ? (
            retryCount > 0 ? (
              <span className="text-yellow-300">
                🔄 网络较慢，正在重试识别 ({retryCount}/3)...
              </span>
            ) : (
              <span className="text-primary-300">⏳ 正在识别语音，请稍候...</span>
            )
          ) : (
            '支持文字输入或点击麦克风按钮语音输入（最长30秒，识别后可编辑）'
          )}
        </div>
        <div className="text-xs text-gray-500">
          Teampo Intelligence v1.0
        </div>
      </div>
    </div>
  )
}
