import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { correctSpeechText } from '@/lib/speechCorrection'

// 硅基流动语音识别API
const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY!,
  baseURL: 'https://api.siliconflow.cn/v1',
  timeout: 20000, // 缩短到20秒超时（音频已优化，识别更快）
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as Blob

    if (!audioFile) {
      return NextResponse.json(
        { error: '未接收到音频文件' },
        { status: 400 }
      )
    }

    console.log('收到音频文件:', {
      size: audioFile.size,
      type: audioFile.type,
    })

    // 检查音频大小（优化后30秒录音约90KB，设置2MB上限足够）
    if (audioFile.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: '音频文件过大，请录制较短的语音（建议10秒内）' },
        { status: 400 }
      )
    }

    // 将Blob转换为File对象
    const file = new File([audioFile], 'audio.webm', { type: 'audio/webm' })

    console.log('开始调用语音识别API...')
    const startTime = Date.now()

    // 调用硅基流动的语音识别API
    // 添加专业术语热词提示，提高技术词汇识别准确率
    let response
    try {
      response = await client.audio.transcriptions.create({
        file: file,
        model: 'FunAudioLLM/SenseVoiceSmall', // 硅基流动提供的中文语音识别模型
        language: 'zh',
        prompt: 'YT8522 YT8512 YT8531 YT8010 YT8011 PHY Switch LED0 LED1 RGMII SGMII MII RMII TX RX link ping 常亮 闪烁 百兆 千兆 车规 以太网 寄存器', // 专业术语热词
      })
    } catch (apiError: any) {
      const duration = Date.now() - startTime
      console.error('语音识别API调用失败:', {
        duration: `${duration}ms`,
        error: apiError.message,
        code: apiError.code,
      })

      // 根据错误类型返回不同的提示
      if (apiError.code === 'ETIMEDOUT' || duration > 20000) {
        return NextResponse.json(
          { error: '语音识别超时，请检查网络连接后重试' },
          { status: 504 }
        )
      }
      throw apiError // 其他错误继续抛出
    }

    const duration = Date.now() - startTime
    const originalText = response.text || ''

    // 应用语音识别后处理修正
    const correctedText = correctSpeechText(originalText)

    console.log('语音识别完成:', {
      duration: `${duration}ms`,
      original: originalText,
      corrected: correctedText,
      changed: originalText !== correctedText,
    })

    return NextResponse.json({
      text: correctedText,
      original: originalText // 用于调试
    })
  } catch (error) {
    console.error('语音识别错误:', error)
    return NextResponse.json(
      { error: '语音识别失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
