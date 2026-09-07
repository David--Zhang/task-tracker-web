// server/routes/categories.js — 分类接口
const express = require('express');

function createCategoriesRouter(db) {
    const router = express.Router();

    // GET /api/categories — 返回所有分类（含活跃任务统计）
    router.get('/', (req, res) => {
        res.json({ data: db.getCategories() });
    });

    return router;
}

module.exports = createCategoriesRouter;
