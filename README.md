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

## 升级版

- 保留原有三时段周历、数据表、私密路径和口令，不需要重新创建日历。
- 桌面显示整周，手机显示所选日期；底部加号可以快速录入。
- 今日概览显示下一项安排、日程数量和待办进度。
- 按当前周的标题/备注搜索，结合类型与“只看未完成”筛选。
- 输入开始时间后自动选择时段；保存跨周日程后自动跳转到对应周。
- 每 90 秒、回到页面时刷新云端数据，仍保留手动同步。
- 网络失败时显示错误并保留录入表单，不当作成功保存。
- 待办支持上下排序；导入前检查完整备份格式并确认覆盖。
- 更多菜单提供导入、导出、同步和锁定日历。
- 快捷键：`C` 新增、`T` 今天、`/` 搜索、左右方向键切周、`Esc` 关闭弹窗。
- 字体使用设备自带楷体和中文无衬线字体，不下载远程字体，不添加分析服务。

旧的单次 Vercel 部署地址不会随更新改变。日常使用项目固定生产域名，并保留原 `/c/{slug}` 路径。

## 验证与无数据库预览

开发运行继续使用 Node.js 20+；运行 TypeScript 单元测试需要 Node.js 24+。

```powershell
npm run test
npm run typecheck
npm run build
```

浏览器验收可使用独立的内存模拟接口，不会连接 Supabase：

```powershell
# 终端一
npm run dev -- --hostname 127.0.0.1 --port 4329
# 终端二
node tests/preview-server.mjs
```

访问 `http://127.0.0.1:4330/c/test-calendar`，使用任意测试口令解锁。仅供本机开发，模拟数据不是真实备份，关闭模拟服务器后丢失。

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
- `POST /api/calendar/lock`
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
