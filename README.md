# 穹弯 · halfsphere

森哥的个人 AI 与基础设施统一作战面板。

---

## 技术栈

- **前端**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **数据请求**: TanStack Query
- **状态管理**: Zustand
- **图表**: Recharts
- **后端**: Next.js API Routes
- **数据库**: Supabase (Postgres + Auth)
- **部署**: Vercel

---

## 本地开发

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，填写以下内容：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
HALFSPHERE_ENCRYPTION_KEY=    # 32 字节 hex，生成方式见下方
CRON_SECRET=your-random-cron-secret
APP_URL=https://halfsphere.com
```

**生成加密密钥：**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 初始化数据库

在 Supabase SQL Editor 中执行 `supabase/migrations/20250516000001_init.sql` 的内容。

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

---

## 部署到 Vercel

### 1. 推送到 Git

```bash
git init
git add .
git commit -m "init: halfsphere mvp"
```

连接 GitHub 仓库到 Vercel。

### 2. 配置环境变量

在 Vercel Dashboard → Project Settings → Environment Variables 中添加：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `HALFSPHERE_ENCRYPTION_KEY`
- `CRON_SECRET`
- `APP_URL`

### 3. 配置 Cron

`vercel.json` 已包含每小时同步任务配置。部署后 Vercel 会自动识别。

### 4. 域名配置

在 Vercel 中添加自定义域名 `halfsphere.com`。

---

## 项目结构

```
halfsphere/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # 含 sidebar
│   │   ├── page.tsx            # 燃烧主页
│   │   ├── settings/page.tsx   # API Key 配置
│   │   └── budget/page.tsx     # 预算设置
│   ├── api/
│   │   ├── providers/route.ts
│   │   ├── usage/route.ts
│   │   ├── usage/sync/route.ts
│   │   ├── cron/hourly/route.ts
│   │   └── budget/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                     # shadcn/ui 组件
│   └── sidebar.tsx
├── hooks/
│   └── use-auth.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   ├── admin.ts
│   │   └── types.ts
│   ├── providers/
│   │   ├── types.ts
│   │   ├── openai.ts
│   │   └── anthropic.ts
│   ├── crypto.ts
│   └── utils.ts
├── supabase/
│   └── migrations/
│       └── 20250516000001_init.sql
├── .env.example
├── vercel.json
└── README.md
```

---

## 功能模块

### 🔥 燃烧 (MVP)

- 追踪 OpenAI / Anthropic 等 provider 的 API 消耗
- 每小时自动同步（Vercel Cron）
- 月度预算 + 两级告警阈值
- AES-256-GCM 加密存储 API Key

### 🤖 舰队 (V2)

- Agent 状态总览
- 心跳推送模式

### 🖥 基地 (V2)

- 服务器健康监控
- 心跳推送模式

---

## 注意事项

1. **API Key 加密**: 所有 provider API Key 均使用 AES-256-GCM 加密存储，密钥通过环境变量 `HALFSPHERE_ENCRYPTION_KEY` 提供。
2. **RLS**: 数据库已开启 Row Level Security，用户只能访问自己的数据。
3. **Cron 鉴权**: `/api/cron/hourly` 必须通过 `Authorization: Bearer ${CRON_SECRET}` 鉴权。
4. **OpenAI Usage API**: 需要使用 Organization Admin Key（以 `sk-` 开头的 key 需要是 admin 级别）。
5. **Anthropic Usage API**: 需要使用 Admin API Key（包含 `admin` 字样的 key）。

---

_由 Kimi 搭建骨架，Claude Design 负责视觉，森哥审决定稿。_
