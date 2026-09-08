// public/offline-store.js — 离线存储层（localStorage 兜底）
// 设计（对应 DESIGN.md §6.3）：
//   - 快照 (snapshot)：最近一次从服务器成功拉取的任务全集，用于离线读取
//   - 操作队列 (ops)：离线期间产生的变更，按顺序记录，联网后重放到服务器
//   - 视图 (view)：snapshot + ops 重放后的当前任务状态，离线时以此为数据源
//
// 本模块同时支持浏览器（挂到 window)与 Node（module.exports，供测试 require）。

(function (root, factory) {
    const OfflineStore = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = OfflineStore;
    } else {
        root.OfflineStore = OfflineStore;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    const SNAPSHOT_KEY = 'task-tracker-offline-snapshot';
    const OPS_KEY = 'task-tracker-offline-ops';

    const CATEGORIES = [
        { id: 'construction', name: 'Construction', icon: '🏗️', description: 'Construction project tasks' },
        { id: 'custom-clearance', name: 'Custom Clearance', icon: '📦', description: 'Custom clearance process tasks' }
    ];

    const CONSTRUCTION_FIELDS = ['name', 'startDate', 'completionDate', 'completionPercentage'];
    const CLEARANCE_FIELDS = ['arrivalDate', 'billOfLading', 'shippingCompany', 'projectName', 'cargoDescription'];

    function makeId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    // 在快照基础上按顺序重放操作队列，得到当前视图
    function applyOps(snapshot, ops) {
        const map = new Map();
        (snapshot || []).forEach(t => map.set(t.id, { ...t }));

        for (const op of ops || []) {
            const t = map.get(op.id) || null;
            const now = new Date().toISOString();
            switch (op.kind) {
                case 'create':
                    map.set(op.task.id, { ...op.task, status: 'active' });
                    break;
                case 'update':
                    if (t) {
                        for (const [k, v] of Object.entries(op.updates || {})) {
                            if (k !== 'id' && k !== 'category_id' && k !== 'status') t[k] = v;
                        }
                        t.updated_at = now;
                    }
                    break;
                case 'archive':
                    if (t) { t.status = 'archived'; t.archived_at = now; delete t.deleted_at; }
                    break;
                case 'unarchive':
                    if (t) { t.status = 'active'; delete t.archived_at; delete t.deleted_at; }
                    break;
                case 'delete':
                    if (t) { t.status = 'deleted'; t.deleted_at = now; delete t.archived_at; }
                    break;
                case 'restore':
                    if (t) { t.status = 'active'; delete t.deleted_at; delete t.archived_at; }
                    break;
                case 'move-to-deleted':
                    if (t) { t.status = 'deleted'; t.deleted_at = now; delete t.archived_at; }
                    break;
                case 'permanent':
                    map.delete(op.id);
                    break;
            }
        }
        return Array.from(map.values());
    }

    class OfflineStore {
        constructor(storage) {
            if (!storage) throw new Error('OfflineStore requires a storage backend');
            this.storage = storage;
        }

        // ---------- 快照 ----------
        _loadSnapshot() {
            try {
                const raw = this.storage.getItem(SNAPSHOT_KEY);
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
        }

        _saveSnapshot(tasks) {
            this.storage.setItem(SNAPSHOT_KEY, JSON.stringify(tasks));
        }

        // ---------- 操作队列 ----------
        _loadOps() {
            try {
                const raw = this.storage.getItem(OPS_KEY);
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
        }

        _saveOps(ops) {
            this.storage.setItem(OPS_KEY, JSON.stringify(ops));
        }

        _enqueue(op) {
            const ops = this._loadOps();
            ops.push(op);
            this._saveOps(ops);
        }

        getOps() {
            return this._loadOps();
        }

        hasPendingOps() {
            return this._loadOps().length > 0;
        }

        clearOps() {
            this._saveOps([]);
        }

        // 丢弃队列开头的 n 个操作（用于 sync 部分成功时移除已重放的前缀）
        discardFirst(n) {
            if (n <= 0) return;
            const ops = this._loadOps();
            this._saveOps(ops.slice(n));
        }

        // 清空全部离线数据（快照 + 队列）
        reset() {
            this.storage.removeItem(SNAPSHOT_KEY);
            this.storage.removeItem(OPS_KEY);
        }

        // ---------- 视图 ----------
        _view() {
            return applyOps(this._loadSnapshot(), this._loadOps());
        }

        // 用服务器返回的某个分类+状态的子集更新快照（仅在无待同步操作时调用，避免覆盖未同步变更）
        mergeSnapshotSubset(categoryId, status, tasks) {
            if (this.hasPendingOps()) return;
            const snapshot = this._loadSnapshot();
            const kept = snapshot.filter(t => !(t.category_id === categoryId && t.status === status));
            const merged = tasks.map(t => ({
                ...t,
                category_id: t.category_id || categoryId,
                status
            }));
            this._saveSnapshot([...kept, ...merged]);
        }

        // ---------- 读接口（对齐后端返回形状） ----------
        list(categoryId, status = 'active') {
            return this._view().filter(t => t.category_id === categoryId && t.status === status);
        }

        getCategories() {
            const view = this._view();
            return CATEGORIES.map(c => {
                const active = view.filter(t => t.category_id === c.id && t.status === 'active');
                return {
                    ...c,
                    total: active.length,
                    completed: active.filter(t => t.completed).length
                };
            });
        }

        find(id) {
            return this._view().find(t => t.id === id) || null;
        }

        // ---------- 写接口（离线时：入队 + 返回本地计算的结果） ----------
        create(categoryId, taskData) {
            const now = new Date().toISOString();
            const task = {
                id: makeId(),
                category_id: categoryId,
                completed: false,
                created_at: now,
                updated_at: now,
                ...taskData
            };
            this._enqueue({ kind: 'create', task });
            return task;
        }

        update(id, updates) {
            this._enqueue({ kind: 'update', id, updates: { ...updates } });
            return this.find(id);
        }

        archive(id) {
            this._enqueue({ kind: 'archive', id });
            return this.find(id);
        }

        unarchive(id) {
            this._enqueue({ kind: 'unarchive', id });
            return this.find(id);
        }

        softDelete(id) {
            this._enqueue({ kind: 'delete', id });
            return this.find(id);
        }

        restore(id) {
            this._enqueue({ kind: 'restore', id });
            return this.find(id);
        }

        moveToDeleted(id) {
            this._enqueue({ kind: 'move-to-deleted', id });
            return this.find(id);
        }

        permanentDelete(id) {
            this._enqueue({ kind: 'permanent', id });
            return null;
        }
    }

    OfflineStore.SNAPSHOT_KEY = SNAPSHOT_KEY;
    OfflineStore.OPS_KEY = OPS_KEY;
    OfflineStore.CATEGORIES = CATEGORIES;
    OfflineStore.CONSTRUCTION_FIELDS = CONSTRUCTION_FIELDS;
    OfflineStore.CLEARANCE_FIELDS = CLEARANCE_FIELDS;
    OfflineStore.applyOps = applyOps;
    OfflineStore.makeId = makeId;

    return OfflineStore;
});