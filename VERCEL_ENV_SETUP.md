# Vercel 环境变量配置

在 Vercel 部署前，必须在 Vercel 控制台配置以下环境变量：

## 必需的环境变量

访问 https://vercel.com/项目名/settings/environment-variables 添加：

### 1. SILICONFLOW_API_KEY
```
sk-uauenrxxlajaiuqenjnawbtuilqfslatcjflcasfxiaepniv
```
- **作用**: 硅基流动 API 密钥，用于 VLM 原理图分析和 LLM 对话
- **环境**: Production, Preview, Development（全选）

### 2. NEXT_PUBLIC_SUPABASE_URL
```
https://ebkpimejqscdviycyjoi.supabase.co
```
- **作用**: Supabase 数据库 URL（公开配置）
- **环境**: Production, Preview, Development（全选）

### 3. SUPABASE_SERVICE_ROLE_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVia3BpbWVqcXNjZHZpeWN5am9pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc2NTgyMywiZXhwIjoyMDgzMzQxODIzfQ.vzjl9eR8lnhFdPFjfRBdgEUe8Gg-_mHdBFwsvcgThj8
```
- **作用**: Supabase Service Role 密钥（服务端权限）
- **环境**: Production, Preview, Development（全选）
- **警告**: 这是敏感密钥，请勿公开

## 配置步骤

1. 登录 Vercel：https://vercel.com
2. 进入项目 `phy-switch-fae-online-support`
3. 点击 **Settings** → **Environment Variables**
4. 依次添加上述 3 个变量
5. 每个变量都勾选所有环境（Production + Preview + Development）
6. 保存后触发重新部署

## 验证配置

部署成功后，检查：
- ✅ 技术咨询功能可用（依赖 SILICONFLOW_API_KEY）
- ✅ 原理图分析功能可用（依赖 SILICONFLOW_API_KEY + PDF.js worker）
- ✅ 无 500 错误

## 故障排查

如果仍然报错：
1. 检查 Vercel Deployment Logs 中是否有 `undefined` API key 错误
2. 确认环境变量名称完全一致（大小写敏感）
3. 重新部署（有时需要手动触发）
