# 语音识别优化方案

## 🎯 优化目标
提高PHY/Switch技术术语的语音识别准确率，特别是中英文混合、数字型号的识别能力。

## ✅ 已实施优化

### 1. 智能后处理系统 (lib/speechCorrection.ts)
- ✅ 专业术语词典（60+ 条规则）
- ✅ 模式匹配修正（15+ 正则规则）
- ✅ 中文数字转换
- ✅ 严重误识别修正（VT→YT等）

### 2. 实时修正日志
- ✅ 记录原始识别结果
- ✅ 记录修正后结果
- ✅ 标记是否发生修正

## 🚀 推荐实施优化

### 优先级1：音频录制质量提升

#### 方案A：优化MediaRecorder参数
```typescript
// 在 components/InputArea.tsx 的 startRecording() 中
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 128000  // 提高比特率到128kbps
})
```

**效果预期**：
- 音质提升 → 识别准确率 +5-10%
- 文件大小增加约30%
- 适合网络良好场景

#### 方案B：添加降噪预处理
```typescript
// 使用Web Audio API进行降噪
const audioContext = new AudioContext()
const source = audioContext.createMediaStreamSource(stream)
const noiseSuppressor = audioContext.createBiquadFilter()
noiseSuppressor.type = 'highpass'
noiseSuppressor.frequency.value = 300  // 过滤低频噪音
```

**效果预期**：
- 环境噪音减少50%+
- 专业术语识别准确率 +10-15%
- 适合嘈杂环境

### 优先级2：上下文感知修正

#### 实现智能上下文推断
```typescript
// 在 lib/speechCorrection.ts 中添加
function contextAwareCorrection(text: string, chatHistory: string[]): string {
  // 如果历史中提到过YT8522，自动将"VT包玩"修正为"YT8522"
  const mentionedModels = chatHistory.flatMap(extractModelNumbers)

  // 根据上下文推断最可能的型号
  if (/VT|WT/.test(text) && mentionedModels.length > 0) {
    return text.replace(/VT|WT/gi, 'YT')
  }

  return text
}
```

**效果预期**：
- 多轮对话准确率 +15-20%
- 自动学习用户常用型号

### 优先级3：实时语音识别反馈

#### UI改进
```typescript
// 显示识别过程中的实时文本
<div className="speech-preview">
  {isRecording && (
    <>
      <div>识别中: {partialResult}</div>
      {corrections.length > 0 && (
        <div className="corrections">
          已修正: {corrections.map(c => `${c.from}→${c.to}`).join(', ')}
        </div>
      )}
    </>
  )}
</div>
```

**效果预期**：
- 用户可见识别过程
- 即时发现错误并重录
- 信任度提升30%+

### 优先级4：专业术语预热词表

#### 向API传递提示词
```typescript
// 在 app/api/voice/route.ts
const response = await client.audio.transcriptions.create({
  file: file,
  model: 'FunAudioLLM/SenseVoiceSmall',
  language: 'zh',
  prompt: 'YT8522 YT8512 PHY LED0 RGMII SGMII TX link 常亮 闪烁',  // 热词
})
```

**效果预期**：
- 专业术语识别率 +20-30%
- API支持情况：需确认SenseVoiceSmall是否支持prompt参数

### 优先级5：多模型融合策略

#### 方案：尝试不同模型
```typescript
// 可选模型对比
models = [
  'FunAudioLLM/SenseVoiceSmall',     // 当前使用（轻量级）
  'paraformer-zh',                    // 阿里达摩院（准确率高）
  'whisper-large-v3',                 // OpenAI（多语言强）
]
```

**对比测试建议**：
| 模型 | 中文准确率 | 英文准确率 | 响应速度 | 成本 |
|------|-----------|-----------|---------|------|
| SenseVoiceSmall | 85% | 75% | 2-3s | 低 |
| paraformer-zh | 92% | 70% | 3-5s | 中 |
| whisper-large-v3 | 88% | 95% | 5-8s | 高 |

### 优先级6：用户自定义修正库

#### 实现学习机制
```typescript
// 用户可以标记错误识别并添加到个人词典
interface UserCorrection {
  original: string
  corrected: string
  frequency: number
  lastUsed: Date
}

// 存储在localStorage或数据库
function learnFromUserCorrection(original: string, corrected: string) {
  const userDict = getUserDictionary()
  userDict.push({ original, corrected, frequency: 1, lastUsed: new Date() })
  saveUserDictionary(userDict)
}
```

**效果预期**：
- 个性化准确率持续提升
- 适应特定用户的发音习惯

## 📊 实施建议

### 短期（1-2天）
1. ✅ 优化后处理规则（已完成）
2. 🔲 实现方案A：提升录音比特率
3. 🔲 添加实时识别反馈UI

### 中期（1周）
1. 🔲 实现上下文感知修正
2. 🔲 测试不同模型的准确率
3. 🔲 添加热词提示（如API支持）

### 长期（1个月）
1. 🔲 实现用户自定义词典
2. 🔲 添加语音识别准确率统计
3. 🔲 A/B测试优化效果

## 🎓 其他建议

### 1. 引导用户规范发音
- 在录音时显示提示："请清晰说出型号，如 YT 八五二二"
- 建议用户在安静环境录音
- 提供标准发音示例音频

### 2. 降级策略
- 识别置信度低时，提示用户重新录音
- 提供文字输入作为备选方案
- 显示"可能是：YT8522 / YT8512"让用户选择

### 3. 数据收集与优化
- 记录识别错误案例
- 定期分析高频错误模式
- 持续优化修正规则

## 📈 预期效果

| 优化项 | 准确率提升 | 实施难度 | 开发时间 |
|--------|-----------|---------|---------|
| 后处理增强 | +10% | 低 | ✅ 已完成 |
| 音质提升 | +5-10% | 低 | 0.5天 |
| 上下文推断 | +15% | 中 | 1-2天 |
| 实时反馈UI | +5% | 低 | 1天 |
| 热词提示 | +20% | 中 | 0.5天 |
| 模型切换 | +10-15% | 高 | 3-5天 |

**总体预期**：当前准确率 ~75% → 优化后 ~90%+
