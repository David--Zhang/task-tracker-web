# Task Tracker

一个简洁的任务追踪器 Web 应用，用于跟踪不同业务分类下的任务完成情况。当前内置两个业务分类：**Construction（施工）** 与 **Custom Clearance（清关）**，各自拥有独立的字段体系与任务列表。

## ✨ 功能特性

- 🗂️ **双分类任务管理** — Construction / Custom Clearance 独立的任务追踪器
- 📝 **任务 CRUD** — 添加、编辑（未完成任务）、删除（软删除，可恢复）
- 📦 **完成归档** — 完成的任务可归档到「已完成任务」折叠列表，支持恢复
- 🗑️ **软删除与永久删除** — 已删除任务进入折叠列表，可恢复或经确认后永久删除
- 📅 **自动排序** — Construction 按开始日期、Custom Clearance 按到港日期升序
- 🔍 **实时搜索** — 跨字段即时过滤当前分类任务
- ✅ **批量操作** — 全选 / 勾选后批量归档或删除
- 📥 **CSV 导出** — 一键导出当前分类活跃任务（UTF-8 BOM，Excel 兼容）
- 📊 **完成统计** — 侧边栏与列表底部实时显示完成进度
- 🔌 **离线降级** — 服务器不可达时自动切换 localStorage 兜底，操作入队，恢复后可一键/自动同步
- ❤️ **健康检查** — `/api/health` 端点，便于监控与排障
- 📦 **数据迁移** — 提供脚本把 MVP 阶段旧 localStorage 数据导入 SQLite

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | HTML + CSS + 原生 JavaScript | 无框架依赖，`fetch` 调用 REST API |
| 后端 | Node.js + Express 5 | RESTful JSON API |
| 数据库 | SQLite（Node 内置 `node:sqlite`） | 文件型数据库，零原生依赖 |
| 测试 | 自包含测试框架 | 无需 `node --test`，直接 `node xxx.js` 运行 |

## 📁 目录结构

```
task-tracker-web/
├── public/                 # 前端静态文件（由 Express 托管）
│   ├── index.html
│   ├── style.css
│   ├── app.js              # 前端业务逻辑（调用 window.API）
│   ├── api.js              # fetch 客户端（网络优先 + 离线兜底 + 同步）
│   └── offline-store.js    # 离线存储层：快照 + 操作队列（localStorage）
├── server/                 # 后端代码
│   ├── index.js            # Express 入口 + 静态托管 + 健康检查 + 错误处理
│   ├── db.js               # SQLite 连接、schema、种子、字段校验、importTask
│   └── routes/
│       ├── tasks.js        # 任务路由（CRUD + 状态迁移）
│       └── categories.js   # 分类路由（含统计）
├── scripts/
│   ├── migrate.js          # 旧 localStorage 数据迁移脚本
│   └── example-dump.json   # 迁移用示例数据
├── data/                   # SQLite 数据库文件（运行时自动生成，已 gitignore）
│   └── tasks.db
├── test.js                 # 前端核心逻辑单元测试
├── test-mock-api.js        # MockAPI 契约测试（Demo 阶段接口参考）
├── test-server.js          # 后端测试（DB 层 + HTTP 层）
├── test-offline-store.js   # 离线存储层单元测试
├── test-api-offline.js     # 离线兜底 + 同步链路集成测试（对接真实服务器）
├── DESIGN.md               # 产品设计文档
├── README.md               # 本文档
└── package.json
```

## 🚀 快速开始

### 环境要求

- **Node.js ≥ 22.5**（因为使用了内置 `node:sqlite` 驱动；建议直接用最新的 LTS 或 Current 版本）

检查版本：

```bash
node -v
npm -v
```

### 1. 安装依赖

```bash
cd "F:\VS CODE PROJECT\task-tracker-web"
npm install
```

> 仅依赖 `express` 一个包。数据库驱动使用 Node 内置 `node:sqlite`，无需额外安装。

### 2. 启动服务器

```bash
npm start
```

启动成功后会看到：

```
✅ Task Tracker server running at http://localhost:3000
   Database: ...\data\tasks.db
```

### 3. 打开应用

在浏览器访问 **<http://localhost:3000>**。

首次启动会自动创建 `data/tasks.db`，并导入 2 个分类与 7 条演示任务，方便直接体验界面与操作流程。

### 修改端口

默认端口为 `3000`，可通过环境变量 `PORT` 覆盖：

```bash
# Windows PowerShell
$env:PORT=8080; npm start

# macOS / Linux
PORT=8080 npm start
```

> ⚠️ **请通过服务器访问**，不要直接双击打开 `public/index.html`。因为前端通过 `fetch('/api/...')` 相对路径调用后端，`file://` 协议下请求会失败。

## 🧪 运行测试

```bash
npm test
```

等价于依次运行：

```bash
node test.js               # 前端核心逻辑（23 项）
node test-mock-api.js      # MockAPI 契约（16 项）
node test-server.js        # 后端 DB + HTTP（54 项，含健康检查与客户端 id）
node test-offline-store.js # 离线存储层（16 项）
node test-api-offline.js   # 离线兜底 + 同步集成（13 项）
```

共 **122 项测试**。

> 注：本项目未使用 `node --test`（在当前环境会触发子进程限制），测试均以自包含脚本方式运行。

## 📡 API 接口

统一响应格式：

- 成功：`{ "data": ... }`
- 失败：`{ "error": { "code": 400, "message": "..." } }`

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查，返回 `{ "data": { "status": "ok", "uptime": 秒, "timestamp": ISO 时间 } }` |

### 分类

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/categories` | 获取所有分类及活跃任务的 `total` / `completed` 统计 |

### 任务

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/tasks?category_id=xxx&status=active` | 任务列表，`status` ∈ `active` / `archived` / `deleted` |
| `POST` | `/api/tasks` | 创建任务，请求体携带 `category_id` + 分类字段；可选携带 `id`（离线同步重放用，冲突返回 `409`） |
| `PATCH` | `/api/tasks/:id` | 更新字段 / 切换完成状态（按分类白名单校验） |
| `DELETE` | `/api/tasks/:id` | 软删除（移入已删除列表） |
| `POST` | `/api/tasks/:id/archive` | 归档已完成任务 |
| `POST` | `/api/tasks/:id/unarchive` | 从归档恢复到活跃列表 |
| `POST` | `/api/tasks/:id/restore` | 从已删除列表恢复 |
| `POST` | `/api/tasks/:id/move-to-deleted` | 从归档移入已删除列表 |
| `DELETE` | `/api/tasks/:id/permanent` | 永久删除（仅限已归档/已删除任务） |

### 分类字段

- **Construction**：`name`、`startDate`、`completionDate`、`completionPercentage`（整数 0–100）
- **Custom Clearance**：`arrivalDate`、`billOfLading`、`shippingCompany`、`projectName`、`cargoDescription`

服务端会对字段做校验：缺字段 / 空白字符串 / 完成百分比超范围都会返回 `400`。

## 💾 数据存储

任务数据持久化在 `data/tasks.db`（SQLite 单文件）。删除该文件后再启动，会重新播种演示数据。

状态模型（单表 + `status` 列），迁移规则：

| 源状态 | 目标状态 | 操作 |
|--------|----------|------|
| `active` | `archived` | 存档（仅已完成任务） |
| `archived` | `active` | 取消归档 |
| `active` | `deleted` | 软删除 |
| `deleted` | `active` | 恢复 |
| `archived` | `deleted` | 移入删除列表 |
| `archived` / `deleted` | （移除） | 永久删除 |

## 🔌 离线模式（DESIGN.md §6.3）

当后端不可达（未启动 / 网络中断）时，前端自动降级到 localStorage 兜底，保证基本可用：

| 场景 | 行为 |
|------|------|
| 在线读取 | 请求成功后自动缓存快照（`task-tracker-offline-snapshot`），供离线时展示 |
| 离线读取 | 返回本地快照 + 未同步操作的合成视图，界面顶部显示 ⚠️ 离线提示条 |
| 离线写入 | 新增 / 编辑 / 归档 / 删除等操作正常生效并**按顺序入队**（`task-tracker-offline-ops`） |
| 恢复联网 | 提示条变为 📤，点击「🔄 Sync now」或等待每 20 秒的自动同步 |
| 同步过程 | 队列逐个重放到服务器（创建操作携带客户端生成的 id，天然幂等；重复创建返回 `409` 时按失败保留）；部分失败时只丢弃已成功的前缀，剩余操作保留待下次同步 |

实现文件：`public/offline-store.js`（纯逻辑层，UMD 可在 Node 中测试）+ `public/api.js`（网络优先/降级/同步调度）。离线期间数据仅存于当前浏览器，清缓存会丢失未同步操作，请尽快同步。

## 📦 旧数据迁移（MVP localStorage → SQLite）

如果曾用 MVP 版本（纯 localStorage）保存过任务，可按以下步骤导入数据库：

### 1. 从浏览器导出旧数据

在旧版页面打开浏览器控制台执行（结果已复制到剪贴板）：

```js
copy(JSON.stringify({
    construction: JSON.parse(localStorage.getItem('task-tracker-tasks-construction') || '[]'),
    'custom-clearance': JSON.parse(localStorage.getItem('task-tracker-tasks-custom-clearance') || '[]')
}, null, 2));
```

粘贴保存为 `dump.json`（格式参考 `scripts/example-dump.json`）。

### 2. 运行迁移脚本

```bash
# 先预览（不写库）
node scripts/migrate.js dump.json --dry-run

# 确认无误后正式导入（默认写入 data/tasks.db）
node scripts/migrate.js dump.json

# 或指定其他数据库文件
node scripts/migrate.js dump.json --db data/other.db
```

字段映射：旧任务 `{ id, text, completed }` → Construction 映射为 `name`（`completionPercentage` 取 `completed ? 100 : 0`）；Custom Clearance 映射为 `billOfLading` + `cargoDescription`（`projectName` 记为 `(migrated)`）。日期字段置空（界面显示 `-`）。脚本**幂等**：id 已存在时自动跳过，可安全重复运行。

## 📚 更多文档

- 产品设计与架构演进规划见 [`DESIGN.md`](DESIGN.md)