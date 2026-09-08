// server/db.js — SQLite 数据库层（使用 Node 内置 node:sqlite，零原生依赖）
// 数据模型在 DESIGN.md §3 基础上演进：
//   - 任务表包含 Construction / Custom Clearance 两类的差异化字段
//   - 通过 status 列区分活跃 (active) / 已归档 (archived) / 已删除 (deleted) 三种状态

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const VALID_STATUSES = ['active', 'archived', 'deleted'];

const CONSTRUCTION_FIELDS = ['name', 'startDate', 'completionDate', 'completionPercentage'];
const CLEARANCE_FIELDS = ['arrivalDate', 'billOfLading', 'shippingCompany', 'projectName', 'cargoDescription'];

// 可经 PATCH 更新的字段（按分类）
const UPDATABLE_FIELDS = {
    construction: [...CONSTRUCTION_FIELDS, 'completed'],
    'custom-clearance': [...CLEARANCE_FIELDS, 'completed']
};

// camelCase 前端字段 -> snake_case 数据库列
const FIELD_TO_COLUMN = {
    name: 'name',
    startDate: 'start_date',
    completionDate: 'completion_date',
    completionPercentage: 'completion_percentage',
    arrivalDate: 'arrival_date',
    billOfLading: 'bill_of_lading',
    shippingCompany: 'shipping_company',
    projectName: 'project_name',
    cargoDescription: 'cargo_description',
    completed: 'completed'
};

const SCHEMA = `
    CREATE TABLE IF NOT EXISTS categories (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        icon        TEXT NOT NULL,
        description TEXT,
        sort_order  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id                    TEXT PRIMARY KEY,
        category_id           TEXT NOT NULL REFERENCES categories(id),
        status                TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'archived', 'deleted')),
        completed             INTEGER NOT NULL DEFAULT 0,
        name                  TEXT,
        start_date            TEXT,
        completion_date       TEXT,
        completion_percentage INTEGER DEFAULT 0,
        arrival_date          TEXT,
        bill_of_lading        TEXT,
        shipping_company      TEXT,
        project_name          TEXT,
        cargo_description     TEXT,
        archived_at           TEXT,
        deleted_at            TEXT,
        created_at            TEXT NOT NULL,
        updated_at            TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
`;

class ApiError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 数据库行 -> 前端任务对象（camelCase，completed 为布尔值）
function rowToTask(row) {
    const task = {
        id: row.id,
        category_id: row.category_id,
        completed: !!row.completed,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
    if (row.category_id === 'construction') {
        task.name = row.name;
        task.startDate = row.start_date;
        task.completionDate = row.completion_date;
        task.completionPercentage = row.completion_percentage == null ? 0 : row.completion_percentage;
    } else {
        task.arrivalDate = row.arrival_date;
        task.billOfLading = row.bill_of_lading;
        task.shippingCompany = row.shipping_company;
        task.projectName = row.project_name;
        task.cargoDescription = row.cargo_description;
    }
    if (row.archived_at) task.archived_at = row.archived_at;
    if (row.deleted_at) task.deleted_at = row.deleted_at;
    return task;
}

// ========== 字段校验 ==========
function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim() !== '';
}

function validateTaskData(categoryId, data, { partial = false } = {}) {
    const errors = [];

    if (categoryId === 'construction') {
        if (!partial || 'name' in data) {
            if (!isNonEmptyString(data.name)) errors.push('name');
        }
        if (!partial || 'startDate' in data) {
            if (!isNonEmptyString(data.startDate)) errors.push('startDate');
        }
        if (!partial || 'completionDate' in data) {
            if (!isNonEmptyString(data.completionDate)) errors.push('completionDate');
        }
        if ('completionPercentage' in data || !partial) {
            const pct = data.completionPercentage;
            if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
                errors.push('completionPercentage (must be integer 0-100)');
            }
        }
    } else if (categoryId === 'custom-clearance') {
        for (const field of CLEARANCE_FIELDS) {
            if (!partial || field in data) {
                if (!isNonEmptyString(data[field])) errors.push(field);
            }
        }
    } else {
        throw new ApiError(400, `Unknown category_id: ${categoryId}`);
    }

    if ('completed' in data && typeof data.completed !== 'boolean') {
        errors.push('completed (must be boolean)');
    }

    if (errors.length > 0) {
        throw new ApiError(400, `Invalid or missing fields: ${errors.join(', ')}`);
    }
}

// ========== 数据库 API 工厂 ==========
function createDb(dbPath) {
    if (dbPath !== ':memory:') {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    const db = new DatabaseSync(dbPath);
    db.exec(SCHEMA);

    function getTaskRow(id) {
        return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    }

    function requireTask(id) {
        const row = getTaskRow(id);
        if (!row) throw new ApiError(404, 'Task not found');
        return row;
    }

    function requireStatus(row, expected) {
        if (row.status !== expected) {
            throw new ApiError(400, `Task is ${row.status}, expected ${expected}`);
        }
    }

    const api = {
        raw: db,

        close() {
            db.close();
        },

        // GET /api/categories（含活跃任务的 total / completed 统计）
        getCategories() {
            const rows = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
            return rows.map(cat => {
                const stats = db.prepare(
                    'SELECT COUNT(*) AS total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed ' +
                    'FROM tasks WHERE category_id = ? AND status = ?'
                ).get(cat.id, 'active');
                return {
                    id: cat.id,
                    name: cat.name,
                    icon: cat.icon,
                    description: cat.description,
                    total: stats.total,
                    completed: stats.completed || 0
                };
            });
        },

        // GET /api/tasks?category_id=&status=
        listTasks(categoryId, status = 'active') {
            if (!VALID_STATUSES.includes(status)) {
                throw new ApiError(400, `Invalid status: ${status}`);
            }
            const rows = db.prepare(
                'SELECT * FROM tasks WHERE category_id = ? AND status = ? ORDER BY created_at'
            ).all(categoryId, status);
            return rows.map(rowToTask);
        },

        getTask(id) {
            return rowToTask(requireTask(id));
        },

        // POST /api/tasks
        createTask(categoryId, data) {
            if (categoryId !== 'construction' && categoryId !== 'custom-clearance') {
                throw new ApiError(400, `Unknown category_id: ${categoryId}`);
            }
            validateTaskData(categoryId, data);

            const now = new Date().toISOString();
            // 支持客户端传入 id（离线同步 / 幂等创建）；未传则由服务端生成
            const id = typeof data.id === 'string' && data.id ? data.id : generateId();
            if (getTaskRow(id)) {
                throw new ApiError(409, `Task with id "${id}" already exists`);
            }
            const isConstruction = categoryId === 'construction';
            db.prepare(`
                INSERT INTO tasks (
                    id, category_id, status, completed,
                    name, start_date, completion_date, completion_percentage,
                    arrival_date, bill_of_lading, shipping_company, project_name, cargo_description,
                    created_at, updated_at
                ) VALUES (?, ?, 'active', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id, categoryId,
                isConstruction ? data.name.trim() : null,
                isConstruction ? data.startDate : null,
                isConstruction ? data.completionDate : null,
                isConstruction ? data.completionPercentage : 0,
                !isConstruction ? data.arrivalDate : null,
                !isConstruction ? data.billOfLading.trim() : null,
                !isConstruction ? data.shippingCompany.trim() : null,
                !isConstruction ? data.projectName.trim() : null,
                !isConstruction ? data.cargoDescription.trim() : null,
                now, now
            );
            return rowToTask(getTaskRow(id));
        },

        // 批量导入（数据迁移用）：绕过严格字段校验，忠实导入迁移数据；幂等（已存在则跳过）
        importTask(task) {
            if (!task || typeof task !== 'object') {
                throw new ApiError(400, 'Invalid task');
            }
            const categoryId = task.category_id;
            if (categoryId !== 'construction' && categoryId !== 'custom-clearance') {
                throw new ApiError(400, `Unknown category_id: ${categoryId}`);
            }
            const id = typeof task.id === 'string' && task.id ? task.id : generateId();
            if (getTaskRow(id)) {
                return { imported: false, id, reason: 'exists' };
            }

            const now = new Date().toISOString();
            const isConstruction = categoryId === 'construction';
            const status = ['active', 'archived', 'deleted'].includes(task.status) ? task.status : 'active';
            const completed = task.completed ? 1 : 0;
            const completionPercentage = Number.isFinite(Number(task.completionPercentage))
                ? Number(task.completionPercentage)
                : 0;

            db.prepare(`
                INSERT INTO tasks (
                    id, category_id, status, completed,
                    name, start_date, completion_date, completion_percentage,
                    arrival_date, bill_of_lading, shipping_company, project_name, cargo_description,
                    archived_at, deleted_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id, categoryId, status, completed,
                isConstruction ? (task.name ?? null) : null,
                isConstruction ? (task.startDate ?? null) : null,
                isConstruction ? (task.completionDate ?? null) : null,
                isConstruction ? completionPercentage : 0,
                !isConstruction ? (task.arrivalDate ?? null) : null,
                !isConstruction ? (task.billOfLading ?? null) : null,
                !isConstruction ? (task.shippingCompany ?? null) : null,
                !isConstruction ? (task.projectName ?? null) : null,
                !isConstruction ? (task.cargoDescription ?? null) : null,
                task.archived_at ?? null,
                task.deleted_at ?? null,
                task.created_at ?? now,
                task.updated_at ?? now
            );
            return { imported: true, id };
        },

        // PATCH /api/tasks/:id（活跃或已归档任务可更新；字段按分类白名单校验）
        updateTask(id, updates) {
            const row = requireTask(id);
            if (row.status === 'deleted') {
                throw new ApiError(400, 'Cannot update a deleted task');
            }

            const allowed = UPDATABLE_FIELDS[row.category_id] || [];
            const clean = {};
            for (const key of Object.keys(updates || {})) {
                if (allowed.includes(key)) clean[key] = updates[key];
            }
            if (Object.keys(clean).length === 0) {
                throw new ApiError(400, 'No valid fields to update');
            }
            validateTaskData(row.category_id, clean, { partial: true });

            const setClauses = [];
            const values = [];
            for (const [field, value] of Object.entries(clean)) {
                const column = FIELD_TO_COLUMN[field];
                if (field === 'completed') {
                    setClauses.push(`${column} = ?`);
                    values.push(value ? 1 : 0);
                } else if (field === 'completionPercentage') {
                    setClauses.push(`${column} = ?`);
                    values.push(value);
                } else {
                    setClauses.push(`${column} = ?`);
                    values.push(typeof value === 'string' ? value.trim() : value);
                }
            }
            setClauses.push('updated_at = ?');
            values.push(new Date().toISOString());
            values.push(id);

            db.prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
            return rowToTask(getTaskRow(id));
        },

        // ========== 状态迁移 ==========
        archiveTask(id) {
            const row = requireTask(id);
            requireStatus(row, 'active');
            if (!row.completed) {
                throw new ApiError(400, 'Only completed tasks can be archived');
            }
            db.prepare("UPDATE tasks SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?")
                .run(new Date().toISOString(), new Date().toISOString(), id);
            return rowToTask(getTaskRow(id));
        },

        unarchiveTask(id) {
            const row = requireTask(id);
            requireStatus(row, 'archived');
            db.prepare("UPDATE tasks SET status = 'active', archived_at = NULL, updated_at = ? WHERE id = ?")
                .run(new Date().toISOString(), id);
            return rowToTask(getTaskRow(id));
        },

        softDeleteTask(id) {
            const row = requireTask(id);
            requireStatus(row, 'active');
            db.prepare("UPDATE tasks SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?")
                .run(new Date().toISOString(), new Date().toISOString(), id);
            return rowToTask(getTaskRow(id));
        },

        restoreTask(id) {
            const row = requireTask(id);
            requireStatus(row, 'deleted');
            db.prepare("UPDATE tasks SET status = 'active', deleted_at = NULL, updated_at = ? WHERE id = ?")
                .run(new Date().toISOString(), id);
            return rowToTask(getTaskRow(id));
        },

        moveArchivedToDeleted(id) {
            const row = requireTask(id);
            requireStatus(row, 'archived');
            db.prepare(
                "UPDATE tasks SET status = 'deleted', archived_at = NULL, deleted_at = ?, updated_at = ? WHERE id = ?"
            ).run(new Date().toISOString(), new Date().toISOString(), id);
            return rowToTask(getTaskRow(id));
        },

        // 永久删除（仅限已归档或已删除的任务）
        permanentDeleteTask(id) {
            const row = requireTask(id);
            if (row.status === 'active') {
                throw new ApiError(400, 'Active tasks must be deleted first (soft delete)');
            }
            db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
            return { success: true };
        }
    };

    return api;
}

// ========== 种子数据 ==========
function seed(api) {
    const db = api.raw;

    const catCount = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
    if (catCount === 0) {
        const insertCat = db.prepare(
            'INSERT INTO categories (id, name, icon, description, sort_order) VALUES (?, ?, ?, ?, ?)'
        );
        insertCat.run('construction', 'Construction', '🏗️', 'Construction project tasks', 1);
        insertCat.run('custom-clearance', 'Custom Clearance', '📦', 'Custom clearance process tasks', 2);
    }

    const taskCount = db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n;
    if (taskCount === 0) {
        const now = Date.now();
        const day = 86400000;
        const insert = db.prepare(`
            INSERT INTO tasks (
                id, category_id, status, completed,
                name, start_date, completion_date, completion_percentage,
                arrival_date, bill_of_lading, shipping_company, project_name, cargo_description,
                created_at, updated_at
            ) VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        // 与前端 Demo 数据一致（原 mock-api.js 种子）
        const seedTasks = [
            ['demo-1', 'construction', 1, 'Review architectural blueprints', '2026-01-05', '2026-01-12', 100,
                null, null, null, null, null, now - day, now - day],
            ['demo-2', 'construction', 1, 'Order building materials', '2026-01-08', '2026-01-15', 100,
                null, null, null, null, null, now - day / 2, now - day / 2],
            ['demo-3', 'construction', 0, 'Schedule site inspection', '2026-01-20', '2026-02-01', 35,
                null, null, null, null, null, now, now],
            ['demo-4', 'construction', 0, 'Install electrical wiring', '2026-02-05', '2026-02-20', 0,
                null, null, null, null, null, now, now],
            ['demo-5', 'custom-clearance', 1, null, null, null, 0,
                '2026-02-10', 'BOL-2026-001', 'Maersk', 'Project Alpha', 'Steel beams and construction frames',
                now - day, now - day],
            ['demo-6', 'custom-clearance', 0, null, null, null, 0,
                '2026-02-15', 'BOL-2026-002', 'COSCO', 'Project Beta', 'Electrical cables and switchboards',
                now, now],
            ['demo-7', 'custom-clearance', 0, null, null, null, 0,
                '2026-02-22', 'BOL-2026-003', 'MSC', 'Project Gamma', 'HVAC equipment', now, now]
        ];
        for (const t of seedTasks) {
            insert.run(
                t[0], t[1], t[2],
                t[3], t[4], t[5], t[6],
                t[7], t[8], t[9], t[10], t[11],
                new Date(t[12]).toISOString(), new Date(t[13]).toISOString()
            );
        }
    }
}

// 初始化：建表 + 种子数据，返回数据库 API
function initDb(dbPath) {
    const api = createDb(dbPath);
    seed(api);
    return api;
}

module.exports = { initDb, createDb, seed, ApiError, rowToTask, VALID_STATUSES };
