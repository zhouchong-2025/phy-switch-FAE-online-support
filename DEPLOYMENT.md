# 部署指南

## 📋 部署前准备清单

### 1. 注册必要的服务账号

- [ ] [GitHub](https://github.com) 账号
- [ ] [Vercel](https://vercel.com) 账号
- [ ] [Supabase](https://supabase.com) 账号
- [ ] [硅基流动](https://siliconflow.cn) 账号并获取 API Key

---

## 🗄️ 第一步：配置Supabase数据库

### 1.1 创建Supabase项目

1. 访问 [Supabase Dashboard](https://app.supabase.com)
2. 点击 "New Project"
3. 填写项目信息：
   - Name: `phy-switch-support`
   - Database Password: 设置一个强密码（记住它！）
   - Region: 选择 `Northeast Asia (Tokyo)` 或最近的区域
4. 等待项目创建（约2分钟）

### 1.2 执行数据库初始化脚本

1. 在项目侧边栏找到 **SQL Editor**
2. 点击 "New Query"
3. 复制 `supabase/init.sql` 文件的全部内容
4. 粘贴到编辑器中
5. 点击右下角 **Run** 按钮执行
6. 确认看到 "Supabase数据库初始化完成！" 消息

### 1.3 获取Supabase凭证

1. 在项目侧边栏找到 **Settings** → **API**
2. 复制以下信息：
   - `Project URL` → 这是你的 `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` (secret) → 这是你的 `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **注意**：`service_role` key 有完全权限，不要泄露！

---

## 🔑 第二步：获取硅基流动API Key

### 2.1 注册并获取API Key

1. 访问 [硅基流动官网](https://siliconflow.cn)
2. 注册账号并登录
3. 进入 **控制台** → **API Keys**
4. 点击 "创建新的API Key"
5. 复制生成的 API Key → 这是你的 `SILICONFLOW_API_KEY`

### 2.2 充值（可选）

硅基流动提供免费额度，但建议充值一些以确保服务稳定。

---

## 💻 第三步：本地测试

### 3.1 配置环境变量

在项目根目录创建 `.env` 文件：

\`\`\`bash
cp .env.example .env
\`\`\`

编辑 `.env` 文件，填入你的凭证：

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...你的service_role_key
SILICONFLOW_API_KEY=sk-...你的硅基流动API_key
\`\`\`

### 3.2 安装依赖并初始化数据库

\`\`\`bash
# 安装依赖
npm install

# 初始化数据库（解析PDF并上传到Supabase）
npm run init-db
\`\`\`

等待脚本完成，应该看到类似输出：
\`\`\`
=== 开始初始化数据库 ===

步骤 1: 解析PDF文件
找到 12 个PDF文件
正在解析: YT8512 Datasheet.pdf
  ✓ 提取了 45 个文本块
...
总共提取 XXX 个文本块

步骤 2: 保存解析结果
已保存到: D:\...\data\parsed_chunks.json

步骤 3: 存储到向量数据库
开始批量存储 XXX 个文档块...
进度: 10/XXX
...
批量存储完成！

=== 初始化完成 ===
\`\`\`

### 3.3 启动开发服务器

\`\`\`bash
npm run dev
\`\`\`

访问 http://localhost:3000 测试功能：
- [ ] 测试文字问答
- [ ] 测试语音输入（需要麦克风权限）
- [ ] 检查回答质量和引用来源

---

## 🚀 第四步：部署到Vercel

### 方法A：通过GitHub部署（推荐）

#### 4.1 推送代码到GitHub

\`\`\`bash
# 初始化Git仓库（如果还没有）
git init
git add .
git commit -m "Initial commit: PHY/Switch support system"

# 在GitHub上创建新仓库
# 然后关联并推送
git remote add origin https://github.com/你的用户名/phy-switch-fae-online.git
git branch -M main
git push -u origin main
\`\`\`

#### 4.2 在Vercel导入项目

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "New Project"
3. 选择 "Import Git Repository"
4. 选择你刚才推送的GitHub仓库
5. 配置项目：
   - Framework Preset: `Next.js`
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

#### 4.3 配置环境变量

在 "Environment Variables" 部分添加：

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | 你的Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 你的Supabase service_role key |
| `SILICONFLOW_API_KEY` | 你的硅基流动API key |

确保勾选 **Production**, **Preview**, **Development** 三个环境。

#### 4.4 部署

点击 **Deploy** 按钮，等待部署完成（约2-3分钟）。

部署成功后，Vercel会给你一个域名，类似：
\`\`\`
https://phy-switch-fae-online.vercel.app
\`\`\`

---

### 方法B：使用Vercel CLI

\`\`\`bash
# 安装Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 设置环境变量
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add SILICONFLOW_API_KEY

# 部署到生产环境
vercel --prod
\`\`\`

---

## ✅ 第五步：验证部署

访问你的Vercel域名，测试以下功能：

- [ ] 页面正常加载，蓝色科技风格显示正确
- [ ] 文字输入功能正常，能收到AI回答
- [ ] AI回答有引用来源（PDF文件名和页码）
- [ ] 语音输入功能正常（浏览器会请求麦克风权限）
- [ ] 移动端访问正常（用手机测试）

---

## 🔧 常见问题

### Q1: 初始化数据库时报错 "Missing API key"

**A:** 检查 `.env` 文件是否正确配置了 `SILICONFLOW_API_KEY`。

### Q2: Vercel部署成功但网站报500错误

**A:**
1. 检查Vercel环境变量是否正确配置
2. 在Vercel Dashboard → 项目 → Settings → Functions，检查日志
3. 确认Supabase数据库中有数据（运行过 `npm run init-db`）

### Q3: 语音识别不工作

**A:**
1. 确认浏览器已授予麦克风权限
2. 仅支持HTTPS或localhost，HTTP会被浏览器阻止
3. 检查硅基流动API额度是否用完

### Q4: AI回答质量差或答非所问

**A:**
1. 检查Supabase中的文档数量：在SQL Editor运行 `SELECT count(*) FROM documents;`
2. 如果数量为0，重新运行 `npm run init-db`
3. 调整 `lib/rag.ts` 中的 `temperature` 参数（降低会更保守）

### Q5: 如何更新PDF文档库？

**A:**
1. 将新PDF放入 `Database/` 文件夹
2. （可选）清空现有数据：在Supabase SQL Editor运行 `TRUNCATE documents;`
3. 重新运行 `npm run init-db`
4. 如果已部署，需要在Vercel中重新触发部署

---

## 📊 监控和维护

### Supabase用量监控

1. 在Supabase Dashboard → Settings → Usage
2. 关注：
   - Database size (免费版500MB限制)
   - API requests

### 硅基流动用量监控

1. 在硅基流动控制台查看API调用次数和费用
2. 设置预算提醒

### Vercel监控

1. 在Vercel Dashboard查看：
   - 部署状态
   - 函数调用次数
   - 错误日志

---

## 🎉 完成！

恭喜你成功部署了PHY/Switch技术支持系统！

如有问题，请查看 [README.md](README.md) 或提交Issue。
