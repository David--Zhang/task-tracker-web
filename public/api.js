// public/api.js — 真实后端 API 客户端（含离线降级）
//
// 策略（对应 DESIGN.md §6.3）：
//   1. 网络优先：请求真实后端
//   2. 网络不可用 / 存在待同步操作时，自动降级到 localStore 离线存储
//   3. 联网后调用 API.sync() 将离线期间的操作按顺序重放到服务器
//
// 方法签名与方法返回值与 Demo 阶段的 MockAPI 完全一致，前端业务代码无需改动。

const API = (() => {
    const OfflineStore = typeof window !== 'undefined' ? window.OfflineStore : null;

    // 存储后端：优先 localStorage，不可用时退回内存（测试环境）
    function createStorage() {
        try {
            if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
        } catch {
            /* localStorage 不可用，走内存兜底 */
        }
        const mem = {};
        return {
            getItem(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
            setItem(k, v) { mem[k] = String(v); },
            removeItem(k) { delete mem[k]; }
        };
    }

    const offlineStore = OfflineStore ? new OfflineStore(createStorage()) : null;

    // 网络状态标记（true = 上次网络请求成功）
    let online = true;

    function taskUrl(id, suffix = '') {
        return `/api/tasks/${encodeURIComponent(id)}${suffix}`;
    }

    // 纯网络请求（不做离线兜底），用于 sync 重放
    async function _raw(method, url, body) {
        let res;
        const options = { method };
        if (body !== undefined) {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(body);
        }
        try {
            res = await fetch(url, options);
        } catch {
            const err = new Error('Cannot reach server — is it running? (npm start)');
            err.code = 0;
            throw err;
        }

        let json = {};
        try { json = await res.json(); } catch { /* 非 JSON 响应 */ }

        if (!res.ok || json.error) {
            const message = json.error ? json.error.message : `HTTP ${res.status}`;
            const err = new Error(message);
            err.code = json.error ? json.error.code : res.status;
            throw err;
        }
        online = true;
        return json;
    }

    function isNetworkError(err) {
        return err && err.code === 0;
    }

    // 读取列表：待同步操作存在时直接用本地视图；否则网络优先
    async function readList(categoryId, status, url) {
        if (offlineStore && offlineStore.hasPendingOps()) {
            return { data: offlineStore.list(categoryId, status) };
        }
        try {
            const body = await _raw('GET', url);
            if (offlineStore) offlineStore.mergeSnapshotSubset(categoryId, status, body.data);
            return body;
        } catch (err) {
            if (isNetworkError(err)) {
                online = false;
                return { data: offlineStore ? offlineStore.list(categoryId, status) : [] };
            }
            throw err;
        }
    }

    // 写操作的通用包装：pending ops 存在时直接入队；否则网络优先，失败落本地
    async function writeFallback(networkFn, offlineFn) {
        if (!offlineStore) return networkFn();
        if (offlineStore.hasPendingOps()) {
            return { data: offlineFn() };
        }
        try {
            return await networkFn();
        } catch (err) {
            if (isNetworkError(err)) {
                online = false;
                return { data: offlineFn() };
            }
            throw err;
        }
    }

    // 将队列中某一个操作重放到服务器（严格按照生成时的顺序）
    async function _replay(op) {
        switch (op.kind) {
            case 'create': {
                const t = op.task;
                const payload = { category_id: t.category_id, id: t.id };
                if (t.category_id === 'construction') {
                    Object.assign(payload, {
                        name: t.name, startDate: t.startDate,
                        completionDate: t.completionDate, completionPercentage: t.completionPercentage
                    });
                } else {
                    Object.assign(payload, {
                        arrivalDate: t.arrivalDate, billOfLading: t.billOfLading,
                        shippingCompany: t.shippingCompany, projectName: t.projectName,
                        cargoDescription: t.cargoDescription
                    });
                }
                return _raw('POST', '/api/tasks', payload);
            }
            case 'update':
                return _raw('PATCH', taskUrl(op.id), op.updates);
            case 'archive':
                return _raw('POST', taskUrl(op.id, '/archive'), {});
            case 'unarchive':
                return _raw('POST', taskUrl(op.id, '/unarchive'), {});
            case 'delete':
                return _raw('DELETE', taskUrl(op.id));
            case 'restore':
                return _raw('POST', taskUrl(op.id, '/restore'), {});
            case 'move-to-deleted':
                return _raw('POST', taskUrl(op.id, '/move-to-deleted'), {});
            case 'permanent':
                return _raw('DELETE', taskUrl(op.id, '/permanent'));
            default:
                throw new Error(`Unknown op kind: ${op.kind}`);
        }
    }

    return {
        // ---------- 读接口 ----------
        getCategories() {
            async function run() {
                if (offlineStore && offlineStore.hasPendingOps()) {
                    return { data: offlineStore.getCategories() };
                }
                try {
                    const body = await _raw('GET', '/api/categories');
                    return body;
                } catch (err) {
                    if (isNetworkError(err)) {
                        online = false;
                        return { data: offlineStore ? offlineStore.getCategories() : [] };
                    }
                    throw err;
                }
            }
            return run();
        },

        getTasks(categoryId) {
            return readList(categoryId, 'active',
                `/api/tasks?category_id=${encodeURIComponent(categoryId)}&status=active`);
        },
        getArchived(categoryId) {
            return readList(categoryId, 'archived',
                `/api/tasks?category_id=${encodeURIComponent(categoryId)}&status=archived`);
        },
        getDeleted(categoryId) {
            return readList(categoryId, 'deleted',
                `/api/tasks?category_id=${encodeURIComponent(categoryId)}&status=deleted`);
        },

        // ---------- 写接口 ----------
        createTask(categoryId, taskData) {
            return writeFallback(
                () => _raw('POST', '/api/tasks', { category_id: categoryId, ...taskData }),
                () => offlineStore.create(categoryId, taskData)
            );
        },

        updateTask(id, updates) {
            return writeFallback(
                () => _raw('PATCH', taskUrl(id), updates),
                () => offlineStore.update(id, updates)
            );
        },
        updateArchived(id, updates) {
            return this.updateTask(id, updates);
        },

        archiveTask(id) {
            return writeFallback(
                () => _raw('POST', taskUrl(id, '/archive'), {}),
                () => offlineStore.archive(id)
            );
        },
        unarchiveTask(id) {
            return writeFallback(
                () => _raw('POST', taskUrl(id, '/unarchive'), {}),
                () => offlineStore.unarchive(id)
            );
        },
        deleteTask(id) {
            return writeFallback(
                () => _raw('DELETE', taskUrl(id)),
                () => offlineStore.softDelete(id)
            );
        },
        undeleteTask(id) {
            return writeFallback(
                () => _raw('POST', taskUrl(id, '/restore'), {}),
                () => offlineStore.restore(id)
            );
        },
        deleteFromArchived(id) {
            return writeFallback(
                () => _raw('POST', taskUrl(id, '/move-to-deleted'), {}),
                () => offlineStore.moveToDeleted(id)
            );
        },
        permanentDelete(type, id) {
            return writeFallback(
                () => _raw('DELETE', taskUrl(id, '/permanent')),
                () => offlineStore.permanentDelete(id)
            );
        },

        // ---------- 离线状态与同步 ----------
        hasPendingOps() {
            return offlineStore ? offlineStore.hasPendingOps() : false;
        },
        isOffline() {
            return !online;
        },

        // 把离线期间的操作按顺序重放到服务器；返回 { synced, pending }
        async sync() {
            if (!offlineStore) return { synced: 0, pending: 0 };
            const ops = offlineStore.getOps();
            if (ops.length === 0) return { synced: 0, pending: 0 };

            let synced = 0;
            try {
                for (const op of ops) {
                    await _replay(op);
                    synced++;
                }
                offlineStore.clearOps();
                return { synced, pending: 0 };
            } catch (err) {
                // 只丢弃已成功重放的前缀，保留剩余操作等待下次同步
                if (synced > 0) offlineStore.discardFirst(synced);
                return {
                    synced,
                    pending: offlineStore.getOps().length,
                    error: err.message
                };
            }
        }
    };
})();

window.API = API;