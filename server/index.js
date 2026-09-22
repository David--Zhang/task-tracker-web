// server/index.js — Express 入口
// 按 DESIGN.md §2.3 规划：RESTful JSON API + public/ 静态托管
const path = require('node:path');
const express = require('express');

const { initDb, ApiError } = require('./db');
const createCategoriesRouter = require('./routes/categories');
const createTasksRouter = require('./routes/tasks');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'tasks.db');

function createApp(dbPath = DEFAULT_DB_PATH) {
    const db = initDb(dbPath);
    const app = express();

    app.use(express.json());

    // API 路由
    app.use('/api/categories', createCategoriesRouter(db));
    app.use('/api/tasks', createTasksRouter(db));

    // 健康检查
    app.get('/api/health', (req, res) => {
        res.json({
            data: {
                status: 'ok',
                uptime: Math.round(process.uptime()),
                timestamp: new Date().toISOString()
            }
        });
    });

    // 未知 /api 路径统一返回错误信封
    app.use('/api', (req, res) => {
        res.status(404).json({ error: { code: 404, message: 'Not found' } });
    });

    // 前端静态文件（public/）
    app.use(express.static(path.join(__dirname, '..', 'public')));

    // 集中错误处理：ApiError -> { error: { code, message } }
    app.use((err, req, res, next) => {
        if (err instanceof ApiError) {
            return res.status(err.code).json({ error: { code: err.code, message: err.message } });
        }
        if (err.type === 'entity.parse.failed') {
            return res.status(400).json({ error: { code: 400, message: 'Invalid JSON body' } });
        }
        console.error('Unhandled error:', err);
        res.status(500).json({ error: { code: 500, message: 'Internal server error' } });
    });

    app.locals.db = db;
    return app;
}

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    const app = createApp();
    app.listen(PORT, () => {
        console.log(`✅ Task Tracker server running at http://localhost:${PORT}`);
        console.log(`   Database: ${DEFAULT_DB_PATH}`);
    });
}

module.exports = { createApp };
