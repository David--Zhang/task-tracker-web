// test-api-offline.js — API 客户端离线兜底 + 同步 集成测试
// 验证完整链路：离线写操作入队 → 恢复网络 → sync() 按序重放到真实服务器
// 运行方式: node test-api-offline.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createApp } = require('./server/index');
const OfflineStore = require('./public/offline-store');

// ========== Mock localStorage ==========
function createMockStorage() {
    const store = {};
    return {
        getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
        setItem(key, value) { store[key] = String(value); },
        removeItem(key) { delete store[key]; }
    };
}

// ========== 简易测试框架 ==========
let passed = 0;
let failed = 0;
async function testAsync(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        console.log(`  ❌ ${name}`);
        console.log(`     ${err.stack || err.message}`);
    }
}
function describe(suite, fn) { console.log(`\n📦 ${suite}`); return fn(); }

// ========== 主流程 ==========
(async () => {
    // 1) 启动真实服务器（临时库）
    const TEST_DB = path.join(__dirname, 'data', 'test-api-offline.db');
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    const app = createApp(TEST_DB);
    const server = await new Promise(resolve => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;

    // 2) 浏览器环境垫片：window + 可切换离线的 fetch
    // 注意：必须先捕获原生 fetch，否则包装器内调用 fetch 会无限递归
    const nativeFetch = globalThis.fetch;
    let offlineMode = false;
    global.window = {
        localStorage: createMockStorage(),
        OfflineStore
    };
    global.fetch = (url, options = {}) => {
        if (offlineMode) return Promise.reject(new TypeError('Failed to fetch'));
        const target = String(url).startsWith('/') ? `http://127.0.0.1:${port}${url}` : url;
        return nativeFetch(target, options);
    };

    // 3) 加载 api.js（IIFE，会挂到 window.API）
    const apiSource = fs.readFileSync(path.join(__dirname, 'public', 'api.js'), 'utf8');
    (0, eval)(apiSource);
    const API = global.window.API;
    assert.ok(API, 'window.API 应已定义');

    const constructionCreate = {
        name: 'Offline poured concrete', startDate: '2026-03-01',
        completionDate: '2026-03-20', completionPercentage: 60
    };
    let createdOfflineId;

    await describe('离线期间：读取走本地缓存', async () => {
        await testAsync('首次 GET（在线）拿到种子数据并建立快照', async () => {
            const res = await API.getTasks('construction');
            assert.equal(res.data.length, 4);
        });

        await testAsync('切换离线后 GET 仍返回快照数据', async () => {
            offlineMode = true;
            const res = await API.getTasks('construction');
            assert.equal(res.data.length, 4);
            assert.equal(API.isOffline(), true);
        });

        await testAsync('离线 getCategories 从本地视图计算统计', async () => {
            const res = await API.getCategories();
            const c = res.data.find(x => x.id === 'construction');
            assert.equal(c.total, 4);
            assert.equal(c.completed, 2);
        });
    });

    await describe('离线期间：写操作入队', async () => {
        await testAsync('createTask 返回本地生成任务并入队', async () => {
            const res = await API.createTask('construction', constructionCreate);
            createdOfflineId = res.data.id;
            assert.ok(createdOfflineId);
            assert.equal(res.data.completed, false);
            assert.equal(API.hasPendingOps(), true);
        });

        await testAsync('列表读取立即包含离线任务（视图 = 快照+队列）', async () => {
            const res = await API.getTasks('construction');
            assert.equal(res.data.length, 5);
            assert.ok(res.data.find(t => t.id === createdOfflineId));
        });

        await testAsync('离线 updateTask 生效并入队', async () => {
            const res = await API.updateTask(createdOfflineId, { completed: true });
            assert.equal(res.data.completed, true);
        });

        await testAsync('离线归档改变状态', async () => {
            await API.archiveTask(createdOfflineId);
            const active = await API.getTasks('construction');
            const archived = await API.getArchived('construction');
            assert.equal(active.data.find(t => t.id === createdOfflineId), undefined);
            assert.ok(archived.data.find(t => t.id === createdOfflineId));
        });
    });

    await describe('恢复网络：sync 重放到真实服务器', async () => {
        await testAsync('sync 重放全部 3 个离线写操作', async () => {
            offlineMode = false;
            const result = await API.sync();
            assert.equal(result.error, undefined);
            assert.equal(result.synced, 3); // create + update + archive
            assert.equal(result.pending, 0);
            assert.equal(API.hasPendingOps(), false);
        });

        await testAsync('服务器 archived 列表包含离线任务且保留客户端 id', async () => {
            const archived = await (await fetch(
                `http://127.0.0.1:${port}/api/tasks?category_id=construction&status=archived`)).json();
            const t = archived.data.find(x => x.id === createdOfflineId);
            assert.ok(t, '服务器 archived 列表应包含离线任务');
            assert.equal(t.name, constructionCreate.name);
            assert.equal(t.completionPercentage, 60);
            assert.equal(t.completed, true);
        });

        await testAsync('服务器分类统计正确（归档不计入 active）', async () => {
            const cats = await (await fetch(`http://127.0.0.1:${port}/api/categories`)).json();
            const c = cats.data.find(x => x.id === 'construction');
            assert.equal(c.total, 4);
            assert.equal(c.completed, 2);
        });
    });

    await describe('部分同步失败时的队列保留', async () => {
        await testAsync('离线产生：create（合法）+ update 到不存在任务（必然失败）', async () => {
            offlineMode = true;
            const r1 = await API.createTask('construction', {
                name: 'Good one', startDate: '2026-04-01', completionDate: '2026-04-02', completionPercentage: 0
            });
            assert.ok(r1.data.id);
            // 直接向同一存储追加一个注定失败的操作（幽灵 id）
            const store = new OfflineStore(global.window.localStorage);
            store._enqueue({ kind: 'update', id: 'ghost-task-does-not-exist', updates: { completed: true } });
            assert.equal(store.getOps().length, 2);
            offlineMode = false;
        });

        await testAsync('sync 部分成功：已重放的移除，失败的保留', async () => {
            const result = await API.sync();
            assert.equal(result.synced, 1);   // create 成功
            assert.equal(result.pending, 1);  // 失败的 update 保留
            assert.ok(result.error);
            assert.equal(API.hasPendingOps(), true);
        });

        await testAsync('合法任务已经同步到了服务器', async () => {
            const list = await (await fetch(
                `http://127.0.0.1:${port}/api/tasks?category_id=construction&status=active`)).json();
            assert.ok(list.data.find(t => t.name === 'Good one'));
        });
    });

    // ========== 汇总 ==========
    await new Promise(resolve => server.close(resolve));
    app.locals.db.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

    console.log('\n========================================');
    console.log(`📊 API 离线测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 个`);
    console.log('========================================\n');
    if (failed > 0) { console.log('❌ 存在失败！'); process.exit(1); }
    else console.log('🎉 所有 API 离线兜底测试通过！');
})();