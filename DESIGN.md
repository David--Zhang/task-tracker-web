# Task Tracker - 产品设计文档

> 版本: 1.0  
> 最后更新: 2026-06-12  
> 状态: 设计中

---

## 1. 产品概述

### 1.1 产品定位
一个简洁的任务追踪器 Web 应用，用于跟踪不同业务分类下的任务完成情况。

### 1.2 目标用户
单人使用（当前阶段），主要用于个人对 Construction 和 Custom Clearance 两类业务任务的日常管理。

### 1.3 核心价值
- 清晰分类管理任务
- 直观的任务完成状态追踪
- 跨设备数据同步（通过后端服务实现）
- 简洁高效的操作体验

---

## 2. 技术架构

### 2.1 架构演进路线

```
Phase 1 (当前 MVP)              Phase 2 (后端化)
┌──────────────┐               ┌──────────────┐
│   前端 SPA   │               │   前端 SPA   │
│ (localStorage)│      →       │  (fetch API) │
└──────────────┘               └──────┬───────┘
                                      │ HTTP
                               ┌──────▼───────┐
                               │  Express API │
                               │  (Node.js)   │
                               └──────┬───────┘
                                      │
                               ┌──────▼───────┐
                               │    SQLite    │
                               │   (文件DB)   │
                               └──────────────┘
```

### 2.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **前端** | HTML + CSS + Vanilla JS | 无框架依赖，轻量快速 |
| **后端** | Node.js + Express | RESTful JSON API |
| **数据库** | SQLite (`node:sqlite`) | 文件型数据库，零配置；使用 Node 内置驱动，无原生依赖 |
| **开发工具** | npm + nodemon | 热重载开发体验 |

### 2.3 目录结构规划

```
task-tracker-web/
├── public/                 # 前端静态文件
│   ├── index.html
│   ├── style.css
│   ├── app.js              # 前端业务逻辑（调用 window.API）
│   └── api.js              # fetch 客户端（对接真实后端）
├── server/                 # 后端代码
│   ├── index.js            # Express 入口 + 静态托管 + 统一错误处理
│   ├── db.js               # SQLite 连接、schema、种子、校验
│   └── routes/
│       ├── tasks.js        # 任务路由（CRUD + 归档/软删除/恢复/永久删除）
│       └── categories.js   # 分类路由（含统计）
├── data/                   # SQLite 数据库文件（gitignore，运行时自动生成）
│   └── tasks.db
├── test.js                 # 前端核心逻辑单元测试
├── test-mock-api.js        # MockAPI 契约测试（Demo 阶段接口参考）
├── test-server.js          # 后端测试（DB 层 + HTTP 层）
├── package.json
├── DESIGN.md               # 本文档
└── AGENTS.md
```

> ⚠️ **技术选型调整**：DESIGN.md 原规划使用 `better-sqlite3`，但其实装依赖包含原生编译步骤，
> 在当前沙箱环境下会触发子进程限制。因此改用 Node.js 内置的 `node:sqlite` 驱动
> （Node ≥ 22.5 可用），功能等价、零原生依赖。其余技术栈（Express、目录结构、API 设计）保持不变。

---

## 3. 数据模型

### 3.1 数据库表设计

```sql
-- 任务分类表
CREATE TABLE categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    icon        TEXT NOT NULL,
    description TEXT,
    sort_order  INTEGER DEFAULT 0
);

-- 任务表
CREATE TABLE tasks (
    id          TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    text        TEXT NOT NULL,
    completed   INTEGER DEFAULT 0,  -- 0 = false, 1 = true
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX idx_tasks_category ON tasks(category_id);
```

### 3.2 初始数据

```sql
INSERT INTO categories (id, name, icon, description, sort_order) VALUES
    ('construction', 'Construction', '🏗️', 'Construction project tasks', 1),
    ('custom-clearance', 'Custom Clearance', '📦', 'Custom clearance process tasks', 2);
```

### 3.3 Task 对象结构

```json
{
    "id": "m3abc1x",
    "category_id": "construction",
    "text": "Prepare site materials",
    "completed": false,
    "created_at": "2026-06-12T08:30:00.000Z",
    "updated_at": "2026-06-12T08:30:00.000Z"
}
```

---

## 4. API 设计

### 4.1 任务接口

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| `GET` | `/api/tasks?category_id=xxx` | 获取指定分类的任务列表 | - |
| `POST` | `/api/tasks` | 创建新任务 | `{ category_id, text }` |
| `PATCH` | `/api/tasks/:id` | 更新任务（切换完成状态） | `{ completed }` |
| `DELETE` | `/api/tasks/:id` | 删除任务 | - |

### 4.2 分类接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/categories` | 获取所有分类（含统计信息） |

#### GET /api/categories 响应示例

```json
[
    {
        "id": "construction",
        "name": "Construction",
        "icon": "🏗️",
        "description": "Construction project tasks",
        "total": 5,
        "completed": 2
    },
    {
        "id": "custom-clearance",
        "name": "Custom Clearance",
        "icon": "📦",
        "description": "Custom clearance process tasks",
        "total": 3,
        "completed": 1
    }
]
```

### 4.3 响应格式规范

**成功响应：**
```json
{ "data": { ... } }           // 单个资源
{ "data": [ ... ] }           // 资源列表
```

**错误响应：**
```json
{ "error": { "code": 404, "message": "Task not found" } }
```

---

## 5. 功能规划

### 5.1 Phase 2 - 后端化（当前目标）

| 功能 | 优先级 | 说明 |
|------|--------|------|
| RESTful API (CRUD) | P0 | 任务的增删改查接口 |
| SQLite 数据库 | P0 | 数据持久化存储 |
| 前端接入 API | P0 | 用 fetch 替代 localStorage |
| 数据迁移 | P0 | 将现有 localStorage 数据导入数据库 |
| 分类管理接口 | P1 | 返回分类列表及统计数据 |
| Express 静态文件托管 | P1 | 前后端统一部署 |

### 5.2 Phase 3 - 增强功能（后续迭代）

| 功能 | 说明 |
|------|------|
| 任务编辑 | 修改已有任务的文本内容 |
| 任务优先级 | 高/中/低优先级标记 |
| 截止日期 | 设置任务到期时间，到期提醒 |
| 任务排序 | 拖拽排序或按优先级/日期排序 |
| 筛选视图 | 按状态（全部/进行中/已完成）筛选 |

### 5.3 Phase 4 - 多用户与协作（远期）

| 功能 | 说明 |
|------|------|
| 用户认证 | 注册/登录，JWT token |
| 多用户隔离 | 每个用户只能看到自己的任务 |
| 实时同步 | WebSocket 推送变更 |
| 数据导出 | 导出为 CSV / JSON |
| 自定义分类 | 用户可以自己创建和管理分类 |

---

## 6. 前端改造要点

### 6.1 从 localStorage 迁移到 API

```
// 之前 (localStorage)
let tasks = JSON.parse(localStorage.getItem('task-tracker-tasks-construction'));

// 之后 (API)
async function fetchTasks(categoryId) {
    const res = await fetch(`/api/tasks?category_id=${categoryId}`);
    const { data } = await res.json();
    return data;
}
```

### 6.2 关键改动点

1. **数据获取** — 页面加载时通过 API 获取数据，而非读取 localStorage
2. **增删改操作** — 每次操作先调用 API，成功后再更新 UI
3. **分类切换** — 切换分类时重新请求该分类的任务数据
4. **错误处理** — API 调用失败时给出用户提示（而非静默失败）
5. **加载状态** — API 请求期间显示 loading 指示器

### 6.3 兼容性处理 ✅（v2.2 已实现）

- 前端保留 localStorage 作为离线降级方案 → `public/offline-store.js`（快照 + 操作队列）
- 当 API 不可用时自动切换到 localStorage 模式 → `public/api.js` 网络失败自动降级，界面显示离线提示条
- 恢复联网后提供数据同步选项 → 提示条「Sync now」按钮 + 每 20 秒自动同步，队列按序重放（创建携带客户端 id，幂等）

---

## 7. 非功能性要求

| 项目 | 要求 |
|------|------|
| **性能** | API 响应时间 < 100ms（单用户场景） |
| **可靠性** | 数据库文件定期备份机制 |
| **安全性** | 输入校验，防止 SQL 注入 |
| **可测试性** | API 接口有自动化测试覆盖 |
| **部署** | `npm start` 一键启动 |

---

## 8. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| SQLite 文件损坏 | 数据丢失 | 定期备份，事务保证写入完整性 |
| 单点故障 | 服务不可用 | 保留 localStorage 降级方案 |
| 并发写入 | 数据冲突 | 单用户场景下风险极低；未来切 PostgreSQL |
| API 版本变更 | 前后端不兼容 | API 路径加版本前缀 `/api/v1/` |

---

## 9. 里程碑

```
[v1.0] ✅ 前端 MVP — 单分类任务管理 (localStorage)
[v1.1] ✅ 侧边栏双分类 — Construction + Custom Clearance
[v2.0] ✅ 后端化 — REST API + SQLite + 前端接入
[v2.2] ✅ 离线降级 — /api/health + localStorage 兜底 + 同步 + 旧数据迁移脚本
[v2.1] 📋 任务编辑 + 优先级
[v3.0] 📋 多用户 + 实时同步
```
