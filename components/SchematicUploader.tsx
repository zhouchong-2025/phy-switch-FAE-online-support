/**
 * 原理图上传器组件
 * 支持拖拽上传、预览、分析和FAE review
 */

'use client'

import { useState, useRef, DragEvent } from 'react'

interface AnalysisResult {
  analysis?: string
  chipModel?: string
  duration?: number
  method?: 'text' | 'vlm'
  fileName?: string
  fileSize?: number
}

interface ReviewResult {
  review?: string
  comparisonScore?: number
  referenceAnalysis?: string
  customerAnalysis?: string
  durations?: {
    reference?: number
    customer?: number
    review?: number
    total?: number
  }
}

export default function SchematicUploader() {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  )
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'analyze' | 'review'>('analyze')
  const [chipModel, setChipModel] = useState('YT8522')
  const [progressMessage, setProgressMessage] = useState<string>('')
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileSelect = (file: File) => {
    // 验证文件类型
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      setError('仅支持PDF、PNG和JPG格式')
      return
    }

    // 验证文件大小
    if (file.size > 10 * 1024 * 1024) {
      setError('文件大小不能超过10MB')
      return
    }

    setError(null)
    setSelectedFile(file)
    setAnalysisResult(null)
    setReviewResult(null)

    // 生成预览
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setPreviewUrl(null)
    }
  }

  const handleAnalyze = async () => {
    if (!selectedFile) return

    setIsAnalyzing(true)
    setError(null)
    setAnalysisResult(null)

    try {
      const formData = new FormData()
      formData.append('schematic', selectedFile)

      const response = await fetch('/api/analyze-schematic', {
        method: 'POST',
        body: formData,
      })

      // 检查响应Content-Type，防止解析HTML错误页
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(`服务器返回非JSON响应 (${response.status}): ${text.substring(0, 200)}`)
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '分析失败')
      }

      setAnalysisResult(data)
    } catch (err: any) {
      console.error('分析错误:', err)

      // 友好的错误提示
      let errorMessage = '分析失败'
      if (err.message.includes('fetch') || err.message.includes('网络')) {
        errorMessage = '❌ 网络连接失败，请检查网络后重试'
      } else if (err.message.includes('timeout') || err.message.includes('超时')) {
        errorMessage = '❌ 分析超时（可能文件过大），请稍后重试'
      } else if (err.message.includes('500')) {
        errorMessage = '❌ 服务器错误，请稍后重试或联系技术支持'
      } else if (err.message.includes('400') || err.message.includes('格式')) {
        errorMessage = '❌ 文件格式或大小不符合要求'
      } else {
        errorMessage = `❌ ${err.message}`
      }

      setError(errorMessage)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleReview = async () => {
    if (!selectedFile) return

    setIsAnalyzing(true)
    setError(null)
    setReviewResult(null)
    setProgressMessage('正在准备...')
    setProgressPercent(0)

    try {
      const formData = new FormData()
      formData.append('customerSchematic', selectedFile)
      formData.append('chipModel', chipModel)

      const response = await fetch('/api/compare-schematic', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
        // 非SSE响应的错误处理
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          const data = await response.json()
          throw new Error(data.error || 'Review失败')
        } else {
          throw new Error(`服务器错误 (${response.status})`)
        }
      }

      // 处理SSE流
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留未完成的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'progress') {
                setProgressMessage(data.message)
                setProgressPercent(data.progress)
              } else if (data.type === 'complete') {
                setReviewResult(data.result)
                setProgressMessage('完成！')
                setProgressPercent(100)
              } else if (data.type === 'error') {
                throw new Error(data.error)
              }
            } catch (parseError) {
              console.error('解析SSE数据失败:', parseError, line)
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Review错误:', err)

      // 友好的错误提示
      let errorMessage = 'Review失败'
      if (err.message.includes('fetch') || err.message.includes('网络')) {
        errorMessage = '❌ 网络连接失败，请检查网络后重试'
      } else if (err.message.includes('timeout') || err.message.includes('超时')) {
        errorMessage = '❌ 分析超时（可能文件过大），请稍后重试'
      } else if (err.message.includes('500')) {
        errorMessage = '❌ 服务器错误，请稍后重试或联系技术支持'
      } else if (err.message.includes('400') || err.message.includes('格式')) {
        errorMessage = '❌ 文件格式或大小不符合要求'
      } else if (err.message.includes('404') || err.message.includes('未找到')) {
        errorMessage = `❌ 未找到${chipModel}的参考设计文件`
      } else {
        errorMessage = `❌ ${err.message}`
      }

      setError(errorMessage)
      setProgressMessage('')
      setProgressPercent(0)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setAnalysisResult(null)
    setReviewResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-6">
      {/* 标题 */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">
          原理图智能分析
        </h2>
        <p className="text-gray-400">
          上传原理图，获取专业的FAE级别分析和优化建议
        </p>
      </div>

      {/* 模式切换 */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setMode('analyze')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            mode === 'analyze'
              ? 'bg-primary-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          📊 单独分析
        </button>
        <button
          onClick={() => setMode('review')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            mode === 'review'
              ? 'bg-primary-600 text-white shadow-lg'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          🔍 FAE Review
        </button>
      </div>

      {/* 芯片型号选择（仅Review模式） */}
      {mode === 'review' && (
        <div className="flex items-center justify-center gap-4">
          <label className="text-white font-medium">芯片型号：</label>
          <select
            value={chipModel}
            onChange={(e) => setChipModel(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-primary-500 focus:outline-none"
          >
            <option value="YT8522">YT8522（百兆双口PHY）</option>
            <option value="YT8512">YT8512（百兆单口PHY）</option>
          </select>
        </div>
      )}

      {/* 上传区域 */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
          isDragging
            ? 'border-primary-500 bg-primary-500/10'
            : 'border-gray-600 hover:border-primary-500/50 bg-gray-800/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {!selectedFile ? (
          <div className="space-y-4">
            <div className="text-6xl">📄</div>
            <div>
              <p className="text-xl text-white font-medium mb-2">
                拖拽文件到此处，或点击选择
              </p>
              <p className="text-gray-400 text-sm">
                支持 PDF、PNG、JPG 格式，最大 10MB
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
            >
              选择文件
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 文件信息 */}
            <div className="flex items-center justify-center gap-4">
              <div className="text-4xl">
                {selectedFile.type === 'application/pdf' ? '📄' : '🖼️'}
              </div>
              <div className="text-left">
                <p className="text-white font-medium">{selectedFile.name}</p>
                <p className="text-gray-400 text-sm">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>

            {/* 预览 */}
            {previewUrl && (
              <div className="max-w-md mx-auto mt-4">
                <img
                  src={previewUrl}
                  alt="预览"
                  className="w-full rounded-lg border border-gray-600"
                />
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-4 justify-center">
              {mode === 'analyze' ? (
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  {isAnalyzing ? '分析中...' : '开始分析'}
                </button>
              ) : (
                <button
                  onClick={handleReview}
                  disabled={isAnalyzing}
                  className="px-8 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  {isAnalyzing ? 'Review中...' : '开始Review'}
                </button>
              )}
              <button
                onClick={handleReset}
                disabled={isAnalyzing}
                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg font-medium transition-colors"
              >
                重新选择
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 分析进度 */}
      {isAnalyzing && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-center mb-4">
            <div className="animate-spin text-5xl mb-4">⚙️</div>
            <p className="text-white font-medium mb-2">
              {mode === 'analyze'
                ? '正在分析原理图...'
                : progressMessage || '正在生成FAE Review...'}
            </p>
            {mode === 'review' && progressPercent > 0 && (
              <div className="mt-4">
                {/* 进度条 */}
                <div className="w-full bg-gray-700 rounded-full h-3 mb-2 overflow-hidden">
                  <div
                    className="bg-primary-500 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-gray-400 text-sm">{progressPercent}%</p>
              </div>
            )}
            <p className="text-gray-400 text-sm mt-2">
              {mode === 'analyze'
                ? '使用VLM深度识别中，预计需要1-2分钟'
                : '正在对比参考设计并���成专业建议'}
            </p>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
          <p className="text-red-200">❌ {error}</p>
        </div>
      )}

      {/* 分析结果 */}
      {analysisResult && mode === 'analyze' && (
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-700 pb-4">
            <h3 className="text-2xl font-bold text-white">分析结果</h3>
            <div className="flex gap-4 text-sm text-gray-400">
              <span>
                方式：{analysisResult.method === 'vlm' ? '🔍 VLM视觉' : '📝 文本'}
              </span>
              <span>耗时：{((analysisResult.duration || 0) / 1000).toFixed(1)}秒</span>
              {analysisResult.chipModel && (
                <span className="text-primary-400 font-medium">
                  芯片：{analysisResult.chipModel}
                </span>
              )}
            </div>
          </div>
          <div className="prose prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-gray-300 bg-gray-900 p-4 rounded-lg overflow-x-auto">
              {analysisResult.analysis}
            </pre>
          </div>
        </div>
      )}

      {/* Review结果 */}
      {reviewResult && mode === 'review' && (
        <div className="space-y-6">
          {/* Review报告 */}
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-700 pb-4">
              <h3 className="text-2xl font-bold text-white">FAE Review 报告</h3>
              <div className="flex gap-4 text-sm text-gray-400">
                {reviewResult.comparisonScore && (
                  <span className="text-primary-400 font-bold text-lg">
                    符合度：{reviewResult.comparisonScore}%
                  </span>
                )}
                <span>
                  总耗时：{((reviewResult.durations?.total || 0) / 1000).toFixed(1)}秒
                </span>
              </div>
            </div>
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-gray-300 bg-gray-900 p-4 rounded-lg overflow-x-auto">
                {reviewResult.review}
              </pre>
            </div>
          </div>

          {/* 详细分析（可折叠） */}
          <details className="bg-gray-800 rounded-lg p-6">
            <summary className="text-lg font-bold text-white cursor-pointer hover:text-primary-400">
              查看详细分析数据
            </summary>
            <div className="mt-4 space-y-6">
              <div>
                <h4 className="text-white font-medium mb-2">参考设计分析</h4>
                <pre className="whitespace-pre-wrap text-sm text-gray-400 bg-gray-900 p-4 rounded-lg overflow-x-auto max-h-96">
                  {reviewResult.referenceAnalysis}
                </pre>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2">客户设计分析</h4>
                <pre className="whitespace-pre-wrap text-sm text-gray-400 bg-gray-900 p-4 rounded-lg overflow-x-auto max-h-96">
                  {reviewResult.customerAnalysis}
                </pre>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
