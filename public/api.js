// public/api.js — 真实后端 API 客户端
// 方法签名与 Demo 阶段的 MockAPI 完全一致，前端业务代码无需改动调用方式。
// 所有方法返回 { data: ... }；失败时抛出带服务端错误信息的 Error。

const API = (() => {
    async function request(url, options = {}) {
        let res;
        try {
            res = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
                ...options
            });
        } catch (networkErr) {
            const err = new Error('Cannot reach server — is it running? (npm start)');
            err.code = 0;
            throw err;
        }

        let body = {};
        try {
            body = await res.json();
        } catch {
            // 非 JSON 响应
        }

        if (!res.ok || body.error) {
            const message = body.error ? body.error.message : `HTTP ${res.status}`;
            const err = new Error(message);
            err.code = body.error ? body.error.code : res.status;
            throw err;
        }
        return body;
    }

    function taskUrl(id, suffix = '') {
        return `/api/tasks/${encodeURIComponent(id)}${suffix}`;
    }

    return {
        // GET /api/categories
        getCategories() {
            return request('/api/categories');
        },

        // GET /api/tasks?category_id=&status=
        getTasks(categoryId) {
            return request(`/api/tasks?category_id=${encodeURIComponent(categoryId)}&status=active`);
        },
        getArchived(categoryId) {
            return request(`/api/tasks?category_id=${encodeURIComponent(categoryId)}&status=archived`);
        },
        getDeleted(categoryId) {
            return request(`/api/tasks?category_id=${encodeURIComponent(categoryId)}&status=deleted`);
        },

        // POST /api/tasks
        createTask(categoryId, taskData) {
            return request('/api/tasks', {
                method: 'POST',
                body: JSON.stringify({ category_id: categoryId, ...taskData })
            });
        },

        // PATCH /api/tasks/:id（服务端同时支持活跃与已归档任务的更新）
        updateTask(id, updates) {
            return request(taskUrl(id), {
                method: 'PATCH',
                body: JSON.stringify(updates)
            });
        },
        updateArchived(id, updates) {
            return this.updateTask(id, updates);
        },

        // 状态迁移
        archiveTask(id) {
            return request(taskUrl(id, '/archive'), { method: 'POST' });
        },
        unarchiveTask(id) {
            return request(taskUrl(id, '/unarchive'), { method: 'POST' });
        },
        deleteTask(id) {
            return request(taskUrl(id), { method: 'DELETE' });
        },
        undeleteTask(id) {
            return request(taskUrl(id, '/restore'), { method: 'POST' });
        },
        deleteFromArchived(id) {
            return request(taskUrl(id, '/move-to-deleted'), { method: 'POST' });
        },

        // 永久删除（type 参数保留以兼容原签名；服务端按任务当前状态判定）
        permanentDelete(type, id) {
            return request(taskUrl(id, '/permanent'), { method: 'DELETE' });
        }
    };
})();

window.API = API;
