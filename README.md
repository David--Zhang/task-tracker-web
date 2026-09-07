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
│   └── api.js              # fetch 客户端，对接真实后端
├── server/                 # 后端代码
│   ├── index.js            # Express 入口 + 静态托管 + 错误处理
│   ├── db.js               # SQLite 连接、schema、种子、字段校验
│   └── routes/
│       ├── tasks.js        # 任务路由（CRUD + 状态迁移）
│       └── categories.js   # 分类路由（含统计）
├── data/                   # SQLite 数据库文件（运行时自动生成，已 gitignore）
│   └── tasks.db
├── test.js                 # 前端核心逻辑单元测试
├── test-mock-api.js        # MockAPI 契约测试（Demo 阶段接口参考）
├── test-server.js          # 后端测试（DB 层 + HTTP 层）
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
node test.js            # 前端核心逻辑（23 项）
node test-mock-api.js   # MockAPI 契约（16 项）
node test-server.js     # 后端 DB + HTTP（47 项）
```

> 注：本项目未使用 `node --test`（在当前环境会触发子进程限制），测试均以自包含脚本方式运行。

## 📡 API 接口

统一响应格式：

- 成功：`{ "data": ... }`
- 失败：`{ "error": { "code": 400, "message": "..." } }`

### 分类

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/categories` | 获取所有分类及活跃任务的 `total` / `completed` 统计 |

### 任务

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/tasks?category_id=xxx&status=active` | 任务列表，`status` ∈ `active` / `archived` / `deleted` |
| `POST` | `/api/tasks` | 创建任务，请求体携带 `category_id` + 分类字段 |
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

## 📚 更多文档

- 产品设计与架构演进规划见 [`DESIGN.md`](DESIGN.md)