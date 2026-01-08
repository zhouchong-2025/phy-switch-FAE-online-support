# Teampo - PHY/Switch 技术支持系统

裕太微以太网 PHY/Switch 智能技术支持系统，基于 RAG (检索增强生成) 技术，提供专业的技术文档问答服务。

## 功能特性

- 📚 **智能文档检索**：基于向量搜索的精准文档匹配
- 💬 **文字/语音交互**：支持文字输入和语音输入两种方式
- 🎯 **强约束回答**：仅基于官方文档回答，避免编造信息
- 📱 **响应式设计**：支持电脑、平板、手机多端访问
- 🎨 **科技风格界面**：蓝色主题，简洁现代

## 技术栈

- **前端框架**：Next.js 15 + React 19 + TypeScript
- **样式方案**：TailwindCSS
- **向量数据库**：Supabase (PostgreSQL + pgvector)
- **AI 模型**：
  - 对话模型：Qwen/Qwen2.5-7B-Instruct (千问)
  - 向量模型：BAAI/bge-large-zh-v1.5
  - 语音识别：FunAudioLLM/SenseVoiceSmall
- **API 服务**：硅基流动 (SiliconFlow)
- **部署平台**：Vercel

## 快速开始

### 1. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 2. 配置环境变量

复制 \`.env.example\` 为 \`.env\` 并填写配置：

\`\`\`bash
cp .env.example .env
\`\`\`

需要配置：
- \`NEXT_PUBLIC_SUPABASE_URL\`: Supabase项目URL
- \`SUPABASE_SERVICE_ROLE_KEY\`: Supabase服务密钥
- \`SILICONFLOW_API_KEY\`: 硅基流动API密钥

### 3. 设置Supabase数据库

在Supabase中执行以下SQL创建表和函数：

\`\`\`sql
-- 启用向量扩展
create extension if not exists vector;

-- 创建文档表
create table documents (
  id bigserial primary key,
  content text not null,
  embedding vector(1024), -- bge-large-zh-v1.5 的向量维度是1024
  metadata jsonb,
  created_at timestamptz default now()
);

-- 创建向量索引
create index on documents using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- 创建向量搜索函数
create or replace function match_documents (
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
returns table (
  content text,
  source text,
  page int,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.content,
    (documents.metadata->>'source')::text as source,
    (documents.metadata->>'page')::int as page,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
\`\`\`

### 4. 初始化数据库

运行脚本解析PDF并存储到向量数据库：

\`\`\`bash
npm run init-db
\`\`\`

此脚本会：
1. 解析 \`Database\` 文件夹中的所有PDF文件
2. 提取文本内容并分块
3. 生成向量嵌入
4. 存储到Supabase向量数据库

### 5. 运行开发服务器

\`\`\`bash
npm run dev
\`\`\`

访问 [http://localhost:3000](http://localhost:3000)

## 部署到Vercel

### 方法一：通过GitHub部署

1. 将代码推送到GitHub仓库
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量（与本地.env相同）
4. 部署

### 方法二：使用Vercel CLI

\`\`\`bash
npm i -g vercel
vercel
\`\`\`

## 项目结构

\`\`\`
.
├── app/                    # Next.js应用目录
│   ├── api/               # API路由
│   │   ├── chat/         # 对话API
│   │   └── voice/        # 语音识别API
│   ├── layout.tsx        # 根布局
│   ├── page.tsx          # 首页
│   └── globals.css       # 全局样式
├── components/            # React组件
│   ├── ChatInterface.tsx # 聊天界面
│   ├── Header.tsx        # 页头
│   ├── InputArea.tsx     # 输入区域
│   └── MessageList.tsx   # 消息列表
├── lib/                   # 核心库
│   ├── pdfParser.ts      # PDF解析
│   ├── rag.ts            # RAG系统
│   └── vectorStore.ts    # 向量存储
├── scripts/               # 脚本
│   └── initDatabase.ts   # 数据库初始化
├── Database/              # PDF文档库
└── public/                # 静态资源
\`\`\`

## API接口

### POST /api/chat

发送用户问题，获取AI回答。

**请求：**
\`\`\`json
{
  "message": "YT8512支持哪些接口？"
}
\`\`\`

**响应：**
\`\`\`json
{
  "response": "根据文档...",
  "sources": [
    "YT8512 Datasheet.pdf (第3页, 相似度: 85.2%)"
  ]
}
\`\`\`

### POST /api/voice

上传音频文件，转换为文字。

**请求：** FormData with \`audio\` file

**响应：**
\`\`\`json
{
  "text": "YT8512支持哪些接口"
}
\`\`\`

## 注意事项

1. **PDF文档要求**：
   - 仅支持PDF格式
   - 建议文档清晰，文字可提取
   - 表格和图片会尽量保留结构

2. **API限制**：
   - 硅基流动API有调用频率限制
   - Supabase免费版有500MB存储限制

3. **语音输入**：
   - 需要浏览器支持麦克风权限
   - 仅支持中文语音识别

## 许可证

MIT

## 联系方式

技术支持：[your-email@example.com](mailto:your-email@example.com)
