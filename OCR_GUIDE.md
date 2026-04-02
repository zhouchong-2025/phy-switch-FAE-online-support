# OCR功能使用指南

## 概述

项目现已集成 **PaddleOCR-VL-1.5** 模型，用于处理扫描版PDF或图片型PDF文档。

## 技术方案

### 使用的模型
- **模型名称**: PaddlePaddle/PaddleOCR-VL-1.5
- **提供商**: 硅基流动（SiliconFlow）
- **类型**: 视觉语言模型（Vision-Language Model）
- **特点**: 支持高精度中英文OCR识别，保留文本布局和表格结构

### 工作原理
1. 将PDF页面渲染为PNG图片（2x分辨率）
2. 将图片Base64编码后发送给PaddleOCR-VL-1.5模型
3. 模型返回识别的文字内容
4. 自动分块并保存到向量数据库

## 使用方法

### 1. 测试单页OCR

```bash
npm run test-ocr single <pdf路径> [页码]
```

示例：
```bash
npm run test-ocr single ./Database/DP83867E.pdf 1
```

### 2. 测试完整PDF OCR（强制所有页面OCR）

```bash
npm run test-ocr full <pdf路径>
```

示例：
```bash
npm run test-ocr full ./Database/产品选型指南.pdf
```

### 3. 混合模式（推荐）

优先使用文本提取，当文本少于50字符时自动切换OCR：

```bash
npm run test-ocr hybrid <pdf路径>
```

示例：
```bash
npm run test-ocr hybrid ./Database/扫描版文档.pdf
```

## 代码集成

### 在代码中使用OCR解析

```typescript
import { parsePDFWithOCR } from './lib/ocrParser'

// 混合模式（推荐）
const chunks = await parsePDFWithOCR('./path/to/file.pdf', false)

// 强制OCR模式
const chunks = await parsePDFWithOCR('./path/to/file.pdf', true)
```

### 单独测试OCR���能

```typescript
import { testOCRSinglePage } from './lib/ocrParser'

const ocrText = await testOCRSinglePage('./path/to/file.pdf', 1)
console.log(ocrText)
```

## 性能考虑

### OCR速度
- **单页OCR**: 约3-5秒/页（取决于页面复杂度）
- **完整文档**: 建议分批处理，避免API速率限制

### 成本优化建议
1. **混合模式最佳**: 优先文本提取��仅在必要时OCR
2. **预检测**: 检查PDF是否可搜索，避免不必要的OCR
3. **缓存结果**: 对已处理的PDF缓存结果

### 适用场景
✅ **适合使用OCR**:
- 扫描版PDF（无法复制文字）
- 图片格式文档
- 含有复杂表格的PDF
- 手写或印刷体混合文档

❌ **不建议使用OCR**:
- 可搜索的原生PDF（文本提取更快更准）
- 纯文本文档（pdfjs-dist已足够）

## API配置

确保 `.env` 文件包含硅基流动API Key:

```bash
SILICONFLOW_API_KEY=your_siliconflow_api_key
```

## 与现有pdfParser的关系

- **lib/pdfParser.ts**: 纯文本提取（pdfjs-dist）
- **lib/ocrParser.ts**: OCR识别（PaddleOCR-VL-1.5）

两者可以共存，根据文档类型选择合适的解析器。

## 故障排查

### 问题1: API��用失败
```
错误: Invalid model 'PaddlePaddle/PaddleOCR-VL-1.5'
```
**解决**: 确认硅基流动平台支持该模型，检查模型名称拼写

### 问题2: 图片渲染失败
```
错误: Canvas creation failed
```
**解决**: 确保已安装canvas依赖（项目已包含）

### 问题3: 内存不足
```
错误: JavaScript heap out of memory
```
**解决**: 增加Node.js内存限制
```bash
node --max-old-space-size=4096 test-ocr.js
```

## 下一步优化方向

1. **并行处理**: 多页面并行OCR（注意API限流）
2. **缓存机制**: 缓存已识别的页面
3. **增量更新**: 仅对新增或修改的PDF进行OCR
4. **结果对比**: 比较pdfjs-dist vs OCR的识别质量
