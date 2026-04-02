# 原理图识别能力测试方案

## 📊 测试目标

评估 **PaddleOCR-VL-1.5** 模型对PHY芯片原理图的识别和理解能力，特别是FAE技术支持场景的实用性。

---

## 📁 测试文件

**原理图**: `Database/YT8522_REF_Schematic.pdf`
- 第1页: 封面页（YT8522 Reference Design V1.0）
- **第2页**: 主要原理图（推荐测试此页）⭐
- 第3页: 其他内容

### 传统文本提取结果（第2页）

pdfjs-dist能够提取 **6418个字符**，包括：
- ✅ 芯片型号: YT8522
- ✅ 元器件: C18(1uF), C19(100nF), R7(75Ω), R11(2.49K), 变压器H1102NL
- ✅ 引脚名: TXDM0_P, TXDM1_P, TXDM0_N, TXDM1_N, RXDV, AVDD33, DVDDLO
- ✅ 晶振: 25M Crystal, 负载电容4pF
- ✅ LED接口: LED1+, LED1-, LED2+, LED2-

**但是**：文本提取**无法理解电路结构、连接关系和设计意图**，这正是VLM的价值所在！

---

## 🛠️ 测试工具

我已经为你创建了以下测试工具：

### 1. 原理图图片分析工具 ⭐推荐
```bash
npm run test-schematic-img <图片路径> [分析模式]
```

**文件**: `test-schematic-img.js`

**支持的分析模式**:
- `basic` - 基础文字识别
- `component` - 元器件清单提取（BOM）
- `analysis` - 技术分析（推荐）⭐
- `fae` - FAE技术支持场景（推荐）⭐
- `detail` - 详细电路分析

### 2. PDF转PNG工具
```bash
node pdf-to-png.js <PDF路径> <页码>
```

**文件**: `pdf-to-png.js`

---

## 📝 测试步骤

### Step 1: 将PDF原理图转换为PNG图片

由于Node.js环境的Canvas渲染限制，需要先手动转换PDF。

#### 方法A: 使用命令行工具（如果已安装）
```bash
node pdf-to-png.js "./Database/YT8522_REF_Schematic.pdf" 2
```

#### 方法B: 手动转换（推荐，最可靠）
1. 用浏览器或PDF阅读器打开 `Database/YT8522_REF_Schematic.pdf`
2. 导航到第2页（主要原理图页）
3. 截图或"另存为图片"
4. 保存为 `YT8522_schematic_page2.png`

#### 方法C: 在线工具
- https://www.ilovepdf.com/pdf_to_image
- https://smallpdf.com/pdf-to-jpg

**提示**: 建议使用300 DPI或更高分辨率，以确保文字清晰。

---

### Step 2: 运行VLM分析测试

#### 测试1: 技术分析模式（推荐）⭐
```bash
npm run test-schematic-img YT8522_schematic_page2.png analysis
```

**评估重点**:
- 能否正确识别芯片型号？
- 能否理解电源设计（几路电源、电压值）？
- 能否识别接口类型（RGMII/SGMII）？
- 能否提取晶振频率和负载电容？
- 能否识别MDI网络变压器？

---

#### 测试2: FAE支持场景（推荐）⭐
```bash
npm run test-schematic-img YT8522_schematic_page2.png fae
```

**评估重点**:
- 能否快速定位设计问题？
- 能否���供实用的调试建议？
- 能否发现潜在的设计风险？
- 是否适合作为FAE的辅助工具？

---

#### 测试3: 元器件清单提取
```bash
npm run test-schematic-img YT8522_schematic_page2.png component
```

**评估重点**:
- 能否生成完整的BOM表？
- 元器件参数识别准确率？
- 是否遗漏关键元件？

---

#### 测试4: 详细电路分析
```bash
npm run test-schematic-img YT8522_schematic_page2.png detail
```

**评估重点**:
- 能否理解引脚连接关系？
- 能否识别功能模块？
- 能否进行信号完整性分析？

---

## 📈 评估标准

### 识别准确率
| 评估项 | 目标 | 如何验证 |
|--------|------|---------|
| 芯片型号识别 | 100% | 对比YT8522 |
| 元器件参数 | >90% | 对比pdfjs提取的文本 |
| 引脚名称 | >85% | 对比datasheet |
| 电路理解 | 人工评估 | FAE专家审核 |

### FAE实用性评估
- **准确性**: 分析结果是否符合实际？
- **实用性**: 是否能辅助快速定位问题？
- **完整性**: 是否覆盖关键检查点？
- **专业度**: 建议是否符合工程实践？

---

## 🎯 测试对比

| 维度 | pdfjs-dist文本提取 | PaddleOCR-VL-1.5 |
|------|------------------|------------------|
| **文字识别** | ✅ 6418字符，准确 | 待测试 |
| **电路理解** | ❌ 无法理解结构 | 待测试⭐ |
| **设计分析** | ❌ 无分析能力 | 待测试⭐ |
| **FAE支持** | ❌ 需人工解读 | 待测试⭐ |
| **BOM提取** | ⚠️ 需后处理 | 待测试 |
| **速度** | 毫秒级 | 3-5秒/图 |
| **成本** | 免费 | API费用 |

**关键结论**：
- 如果只需要**提取文字**，pdfjs-dist足够
- 如果需要**理解电路和技术分析**，VLM才有价值

---

## 📂 测试结果保存

所有测试结果会自动保存到 `./test-results/` 目录：
```
test-results/
├── YT8522_schematic_page2_analysis_2026-04-01T12-30-00.txt
├── YT8522_schematic_page2_fae_2026-04-01T12-35-00.txt
├── YT8522_schematic_page2_component_2026-04-01T12-40-00.txt
└── YT8522_schematic_page2_detail_2026-04-01T12-45-00.txt
```

---

## 🚀 下一步行动

### 你需要做的：
1. ✅ 将 `Database/YT8522_REF_Schematic.pdf` 第2页转换为PNG图片
2. ✅ 运行上述4个测试命令
3. ✅ 查看 `test-results/` 目录中的分析报告
4. ✅ 评估VLM的识别质量和FAE实用性

### 我可以帮你：
- 分析测试结果
- 对比VLM vs 文本提取的优劣
- 评估是否值得集成到FAE支持系统
- 优化prompt策略以提高识别准确率

---

## 💡 预期发现

基于之前的测试经验，我预测：

### 可能的优势：
✅ 能理解电路连接关系
✅ 能识别功能模块
✅ 能提供设计建议
✅ 适合FAE快速诊断

### 可能的劣势：
❌ 复杂表格可能识别错误（之前Product Selection Guide测试失败）
❌ 速度较慢（3-5秒/页）
❌ 可能需要多次调整prompt才能获得最佳效果
❌ OCR准确率可能不如直接文本提取

---

## 🎓 学习目标

通过这次测试，我们将了解：
1. VLM在原理图识别场景的**真实能力**
2. 是否适合作为FAE技术支持的**辅助工具**
3. 相比传统文本提取的**实际价值**
4. 是否值得**正式集成**到项目中

---

准备好了吗？请先转换PDF为PNG，然后开始测试！🚀
