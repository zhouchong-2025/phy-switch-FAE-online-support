/**
 * 语音识别后处理 - 修正专业术语和常见错误
 */

/**
 * 专业术语词典
 */
const TERM_CORRECTIONS = {
  // 产品型号修正（数字+字母混合）
  '852Q': '8522',
  '8512': '8512', // 保护已正确识别的
  '8522': '8522',
  '8531': '8531',
  '8010': '8010',
  '8011': '8011',

  // 常见型号变体
  '85二二': '8522',
  '85一二': '8512',
  '85三一': '8531',
  '80一零': '8010',
  '80一一': '8011',

  // 专业术语修正（英文）
  'fi': 'PHY',
  'Fy': 'PHY',
  '范': 'PHY',
  '非': 'PHY',
  '飞': 'PHY',

  'ID': 'LED',
  'AI地': 'LED',

  'T操': 'TX',
  'T叉': 'TX',
  'T差': 'TX',
  '踢叉': 'TX',

  // 技术词汇修正（中文）
  '常料': '常亮',
  '闪说': '闪烁',
  '摆高': '百兆',
  '千兆': '千兆', // 保护
  '车载': '车载', // 保护
  '乌规': '车规',
  '开网': '以太网',

  // 网络术语修正
  '令次': 'link',
  '灵次': 'link',
  '另次': 'link',
  '平': 'ping',
  '评': 'ping',

  // LED相关
  'ID零': 'LED0',
  'ID0': 'LED0',
  'ID1': 'LED1',
  '爱的零': 'LED0',

  // 接口类型
  'RGB米': 'RGMII',
  'SGMI': 'SGMII',
  'mi': 'MII',
  '米': 'MII',
}

/**
 * 正则替换规则（按优先级）
 */
const REGEX_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  // YT型号修正：YT + 4位数字
  { pattern: /YT\s*(\d{4})/gi, replacement: 'YT$1' },

  // 严重误识别修正（VT/WT等 -> YT）
  { pattern: /VT\s*(\d{4})/gi, replacement: 'YT$1' },
  { pattern: /WT\s*(\d{4})/gi, replacement: 'YT$1' },
  { pattern: /VT包玩/gi, replacement: 'YT8522' },
  { pattern: /VT包完/gi, replacement: 'YT8522' },

  // 单独的4位数字型号（85xx系列）
  { pattern: /\b(85\d{2})\b/g, replacement: 'YT$1' },
  { pattern: /\b(80\d{2}[A-Z]*)\b/g, replacement: 'YT$1' },

  // 型号和英文单词之间添加空格（避免YT8522link粘连）
  { pattern: /(YT\d{4}[A-Z]*)([a-z]+)/gi, replacement: '$1 $2' },
  { pattern: /(\d{4})([a-z]+)/g, replacement: '$1 $2' },

  // LED + 数字（支持中文数字）
  { pattern: /ID\s*(\d+)/gi, replacement: 'LED$1' },
  { pattern: /爱的\s*(\d+)/g, replacement: 'LED$1' },
  { pattern: /LED零/g, replacement: 'LED0' },
  { pattern: /LED一/g, replacement: 'LED1' },
  { pattern: /ID零/g, replacement: 'LED0' },
  { pattern: /ID一/g, replacement: 'LED1' },

  // 常见短语修正
  { pattern: /link\s*不通/gi, replacement: 'link不通' },
  { pattern: /ping\s*不通/gi, replacement: 'ping不通' },

  // 去除多余空格
  { pattern: /\s+/g, replacement: ' ' },
]

/**
 * 修正语音识别结果
 */
export function correctSpeechText(text: string): string {
  let corrected = text.trim()

  // 1. 应用词典替换
  Object.entries(TERM_CORRECTIONS).forEach(([wrong, correct]) => {
    // 使用word boundary确保完整匹配
    const regex = new RegExp(`\\b${escapeRegex(wrong)}\\b`, 'gi')
    corrected = corrected.replace(regex, correct)
  })

  // 2. 应用正则规则
  REGEX_RULES.forEach(rule => {
    corrected = corrected.replace(rule.pattern, rule.replacement)
  })

  // 3. 标准化空格
  corrected = corrected.trim().replace(/\s+/g, ' ')

  return corrected
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 生成修正建议（用于UI显示）
 */
export function getSpeechCorrections(original: string, corrected: string): string[] {
  const corrections: string[] = []

  if (original !== corrected) {
    // 找出具体改了什么
    const originalWords = original.split(/\s+/)
    const correctedWords = corrected.split(/\s+/)

    // 简单对比（实际应用可以用更复杂的diff算法）
    if (originalWords.length === correctedWords.length) {
      for (let i = 0; i < originalWords.length; i++) {
        if (originalWords[i] !== correctedWords[i]) {
          corrections.push(`"${originalWords[i]}" → "${correctedWords[i]}"`)
        }
      }
    } else {
      corrections.push('识别结果已优化')
    }
  }

  return corrections
}
