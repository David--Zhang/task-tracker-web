// server/routes/tasks.js — 任务接口（CRUD + 归档 / 软删除 / 恢复 / 永久删除）
const express = require('express');

const VALID_CATEGORIES = ['construction', 'custom-clearance'];

function createTasksRouter(db) {
    const router = express.Router();

    // GET /api/tasks?category_id=xxx&status=active|archived|deleted
    router.get('/', (req, res) => {
        const categoryId = req.query.category_id;
        const status = req.query.status || 'active';
        if (!VALID_CATEGORIES.includes(categoryId)) {
            return res.status(400).json({
                error: { code: 400, message: `category_id is required and must be one of: ${VALID_CATEGORIES.join(', ')}` }
            });
        }
        res.json({ data: db.listTasks(categoryId, status) });
    });

    // POST /api/tasks — 创建任务（请求体: { category_id, ...分类字段 }）
    router.post('/', (req, res) => {
        const { category_id: categoryId, ...taskData } = req.body || {};
        const task = db.createTask(categoryId, taskData);
        res.status(201).json({ data: task });
    });

    // PATCH /api/tasks/:id — 更新任务字段 / 切换完成状态
    router.patch('/:id', (req, res) => {
        res.json({ data: db.updateTask(req.params.id, req.body || {}) });
    });

    // DELETE /api/tasks/:id — 软删除（移入已删除列表）
    router.delete('/:id', (req, res) => {
        res.json({ data: db.softDeleteTask(req.params.id) });
    });

    // POST /api/tasks/:id/archive — 归档已完成任务
    router.post('/:id/archive', (req, res) => {
        res.json({ data: db.archiveTask(req.params.id) });
    });

    // POST /api/tasks/:id/unarchive — 从归档恢复到活跃列表
    router.post('/:id/unarchive', (req, res) => {
        res.json({ data: db.unarchiveTask(req.params.id) });
    });

    // POST /api/tasks/:id/restore — 从已删除列表恢复
    router.post('/:id/restore', (req, res) => {
        res.json({ data: db.restoreTask(req.params.id) });
    });

    // POST /api/tasks/:id/move-to-deleted — 从归档列表移入已删除列表
    router.post('/:id/move-to-deleted', (req, res) => {
        res.json({ data: db.moveArchivedToDeleted(req.params.id) });
    });

    // DELETE /api/tasks/:id/permanent — 永久删除（仅限已归档/已删除任务）
    router.delete('/:id/permanent', (req, res) => {
        res.json({ data: db.permanentDeleteTask(req.params.id) });
    });

    return router;
}

module.exports = createTasksRouter;
