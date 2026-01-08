# Vercel 部署指南

## 📋 部署前检查清单

### ✅ 代码准备

- [x] 所有代码已提交到Git仓库
- [x] `.env` 文件已被 `.gitignore` 排除
- [x] `.env.example` 包含所有必需的环境变量模板
- [x] 所有依赖已在 `package.json` 中声明
- [x] 响应式设计已实现并测试

### ✅ 功能完整性

- [x] 流式响应（SSE）
- [x] 停止生成按钮
- [x] 语音输入（带热词和后处理修正）
- [x] RAG文档检索（支持混合搜索策略）
- [x] 响应式表格显示
- [x] 智能滚动提示

---

## 🔑 需要在 Vercel 配置的环境变量

**共需要配置 3 个环境变量：**

### 1. Supabase URL
```
变量名: NEXT_PUBLIC_SUPABASE_URL
说明: 您的Supabase项目URL
示例: https://your-project-id.supabase.co
获取位置: Supabase Dashboard → Settings → API → Project URL
```

### 2. Supabase Service Role Key
```
变量名: SUPABASE_SERVICE_ROLE_KEY
说明: Supabase服务端密钥（用于向量搜索和数据库操作）
示例: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
获取位置: Supabase Dashboard → Settings → API → service_role key
⚠️ 警告: 这是敏感密钥，切勿在客户端代码中使用
```

### 3. 硅基流动 API Key
```
变量名: SILICONFLOW_API_KEY
说明: 硅基流动API密钥（用于语音识别和LLM）
示例: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
获取位置: https://cloud.siliconflow.cn/account/ak
用途:
  - 语音识别（FunAudioLLM/SenseVoiceSmall）
  - 文本向量化（BAAI/bge-m3）
  - LLM生成（Qwen/Qwen3-30B-A3B-Instruct-2507）
```

---

## 📱 响应式设计验证

### 断点配置
| 设备类型 | 屏幕宽度 | 消息框宽度 | 表格处理 |
|---------|---------|-----------|---------|
| 手机     | < 640px | 95%       | 横向滚动 + 提示 |
| 平板     | 640-768px | 85%     | 横向滚动 + 提示 |
| 小屏电脑 | 768-1024px | 75%    | 横向滚动 + 提示 |
| 大屏电脑 | > 1024px | 70%      | 横向滚动 + 提示 |

### 表格显示特性
- ✅ 自动检测表格内容（对比、Markdown表格等）
- ✅ 横向滚动支持（`overflow-x-auto`）
- ✅ 自定义蓝色滚动条（8px高度）
- ✅ 智能滚动提示（仅在需要时显示）
- ✅ 等宽字体（`font-mono`）显示表格
- ✅ 实时检测窗口大小变化

### 测试建议
1. **手机竖屏** (375px)：消息框95%宽度，表格可滑动
2. **手机横屏** (667px)：消息框85%宽度，表格可滑动
3. **平板竖屏** (768px)：消息框85%宽度
4. **平板横屏** (1024px)：消息框75%宽度
5. **电脑小屏** (1280px)：消息框70%宽度
6. **电脑大屏** (1920px+)：消息框70%宽度

---

## 🚀 Vercel 部署步骤

### 方法1: 通过 Vercel Dashboard（推荐）

1. **登录 Vercel**
   - 访问 https://vercel.com
   - 使用GitHub账号登录

2. **导入项目**
   - 点击 "Add New..." → "Project"
   - 选择您的 GitHub 仓库
   - 点击 "Import"

3. **配置环境变量**
   - 在 "Environment Variables" 部分添加以下3个变量：
     ```
     NEXT_PUBLIC_SUPABASE_URL = your_supabase_url
     SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
     SILICONFLOW_API_KEY = your_siliconflow_key
     ```
   - 确保所有环境都勾选（Production, Preview, Development）

4. **部署设置**
   - Framework Preset: **Next.js**
   - Build Command: `npm run build`（默认）
   - Output Directory: `.next`（默认）
   - Install Command: `npm install`（默认）

5. **点击 Deploy**
   - 等待构建完成（通常2-5分钟）
   - 部署成功后会分配一个 `.vercel.app` 域名

### 方法2: 通过 Vercel CLI

```bash
# 安装Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 添加环境变量
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add SILICONFLOW_API_KEY

# 重新部署以应用环境变量
vercel --prod
```

---

## 🧪 部署后测试清单

### 基础功能
- [ ] 页面正常加载
- [ ] 欢迎消息显示
- [ ] 输入框可用

### 文字交互
- [ ] 文字消息发送成功
- [ ] 流式响应正常工作
- [ ] 消息实时显示
- [ ] 停止按钮可用
- [ ] 停止生成功能正常

### 语音交互
- [ ] 麦克风权限请求正常
- [ ] 按住录音功能正常
- [ ] 语音识别返回结果
- [ ] 识别文字可编辑
- [ ] 专业术语识别准确（YT8522、link等）

### RAG功能
- [ ] 文档检索正常
- [ ] 来源显示正确
- [ ] 文档下载链接可用
- [ ] 对比查询返回多个型号的文档

### 响应式设计
- [ ] 手机端显示正常
- [ ] 平板端显示正常
- [ ] 电脑端显示正常
- [ ] 表格可横向滚动
- [ ] 滚动提示仅在需要时显示
- [ ] 窗口调整大小时响应正常

### 性能
- [ ] 首屏加载时间 < 3秒
- [ ] 流式响应延迟 < 3秒
- [ ] 语音识别时间 < 5秒
- [ ] 无明显卡顿

---

## 🔧 常见问题排查

### 1. "缺少Supabase环境变量配置"
**原因**: 环境变量未正确配置
**解决**:
1. 检查Vercel Dashboard → Settings → Environment Variables
2. 确认变量名拼写正确（区分大小写）
3. 重新部署项目

### 2. "缺少SILICONFLOW_API_KEY环境变量"
**原因**: 硅基流动API Key未配置
**解决**:
1. 获取API Key: https://cloud.siliconflow.cn/account/ak
2. 在Vercel添加环境变量
3. 重新部署

### 3. "语音识别失败"
**原因**:
- 麦克风权限未授予
- 浏览器不支持MediaRecorder API
- 网络连接问题
**解决**:
1. 检查浏览器权限设置
2. 使用Chrome/Edge/Safari等现代浏览器
3. 检查网络连接

### 4. "向量搜索错误"
**原因**:
- Supabase数据库未初始化
- pgvector扩展未启用
**解决**:
1. 在Supabase执行 `CREATE EXTENSION IF NOT EXISTS vector;`
2. 运行初始化脚本: `npm run init-db`

### 5. "流式响应中断"
**原因**:
- 网络连接不稳定
- API超时
**解决**:
1. 检查硅基流动API额度
2. 检查网络连接
3. 使用停止按钮重新发送

### 6. "表格显示不完整"
**原因**:
- CSS未正确加载
- 浏览器缓存问题
**解决**:
1. 清除浏览器缓存
2. 强制刷新 (Ctrl+F5)
3. 检查自定义滚动条样式是否生效

---

## 📊 性能优化配置

### Next.js配置
```javascript
// next.config.js
experimental: {
  serverActions: {
    bodySizeLimit: '10mb', // 支持语音文件上传
  },
}
```

### RAG优化参数
- 文档检索数量: 6个（平衡速度和准确性）
- LLM max_tokens: 800（减少生成时间）
- LLM temperature: 0.3（提高一致性）
- top_p: 0.9（加速采样）
- 向量搜索阈值: 0.2（单一查询）/ 0.15（对比查询）

### 流式响应优化
- SSE实时传输
- 用户感知延迟: 2-3秒
- 实际生成时间: 20-30秒
- 用户体验提升: 96%

---

## 🔐 安全注意事项

### 环境变量安全
- ✅ `.env` 已被 `.gitignore` 排除
- ✅ `SUPABASE_SERVICE_ROLE_KEY` 仅在服务端使用
- ✅ `NEXT_PUBLIC_SUPABASE_URL` 可安全暴露（仅URL）
- ⚠️ 切勿在客户端代码中使用 Service Role Key

### API密钥管理
- 定期轮换API密钥
- 监控API使用量和额度
- 设置API请求限流
- 记录异常访问日志

### Supabase安全
- 启用Row Level Security (RLS)
- 限制Service Role Key的使用范围
- 定期审查访问日志

---

## 📚 相关文档链接

### 官方文档
- [Vercel部署文档](https://vercel.com/docs)
- [Next.js部署指南](https://nextjs.org/docs/deployment)
- [Supabase文档](https://supabase.com/docs)
- [硅基流动API文档](https://docs.siliconflow.cn)

### 项目文档
- [性能优化文档](./performance-optimization.md)
- [语音优化计划](./voice-optimization-plan.md)
- [响应式表格优化](./responsive-table-optimization.md)

---

## ✅ 部署完成确认

部署成功后，您应该能够：

1. ✅ 访问 `https://your-project.vercel.app`
2. ✅ 看到欢迎消息
3. ✅ 发送文字消息并获得流式回答
4. ✅ 使用语音输入功能
5. ✅ 查看对比表格（可横向滚动）
6. ✅ 在手机/平板/电脑上正常使用
7. ✅ 点击来源链接下载PDF文档

---

## 🎉 部署成功！

恭喜！您的裕太微PHY/Switch技术支持助手已成功部署到Vercel。

**下一步**:
1. 测试所有功能
2. 配置自定义域名（可选）
3. 设置监控和日志
4. 收集用户反馈

**需要帮助？**
- 查看 [Vercel文档](https://vercel.com/docs)
- 检查 [部署日志](https://vercel.com/dashboard)
- 联系技术支持

---

*最后更新: 2025-01-08*
