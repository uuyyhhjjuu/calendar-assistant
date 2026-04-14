# 个人日程助手（最小云端版）

可通过私密链接访问，输入口令后读写同一份日程数据。支持免费部署（Vercel + Supabase 免费额度）。

## 隐私与安全

- 不需要手机号/邮箱登录。
- 每个日历使用随机 `slug` 私密链接。
- 口令只存哈希（`bcrypt`），不存明文。
- 解锁后使用 HTTP-only 会话 Cookie。
- 写接口必须已解锁；口令尝试有内存限流与短时锁定。

## 已实现功能

- 周视图：上午/下午/晚上
- 新增/编辑/删除/完成日程
- 日程类型：`工作💼 / 个人🏠 / 社交🥂`（支持筛选）
- 卡片紧凑展示：类型与时间同一行，操作按钮悬停显示
- 日程按开始时间从上到下排序
- 日期备注、待办事项
- 导入 / 导出 JSON
- 2026 法定节假日与调休上班标注

## 本地开发

1. 安装 Node.js 20+
2. `npm install`
3. 复制环境变量：`cp .env.example .env.local`
4. Supabase SQL Editor 执行 `supabase/schema.sql`
5. `npm run dev`

## 最小免费上线（推荐）

1. 在 Supabase 创建项目（Free），拿到 `DATABASE_URL`
2. 在 GitHub 创建仓库并推送代码
3. 在 Vercel 导入仓库（Free）
4. 配置环境变量：
   - `DATABASE_URL`
   - `SESSION_SECRET`（至少 32 位随机串）
   - `NEXT_PUBLIC_APP_URL`（你的 Vercel 域名）
5. Deploy 后访问首页创建日历，得到私密链接 `/c/{slug}`

## API

- `POST /api/calendar/create`
- `POST /api/calendar/unlock`
- `GET /api/week?slug=...&weekStart=YYYY-MM-DD`
- `POST /api/event`
- `PUT /api/event/:id`
- `DELETE /api/event/:id`
- `POST /api/day-note`
- `POST /api/todo`
- `PUT /api/todo/:id`
- `DELETE /api/todo/:id`
- `GET /api/export?slug=...`
- `POST /api/import`