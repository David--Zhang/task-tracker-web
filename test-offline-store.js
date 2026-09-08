// test-offline-store.js — OfflineStore 离线存储层单元测试
// 运行方式: node test-offline-store.js
const assert = require('node:assert/strict');
const OfflineStore = require('./public/offline-store');

// ========== Mock localStorage ==========
function createMockStorage() {
    const store = {};
    return {
        getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
        setItem(key, value) { store[key] = String(value); },
        removeItem(key) { delete store[key]; },
        clear() { for (const k of Object.keys(store)) delete store[k]; }
    };
}

// ========== 测试框架 ==========
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        console.log(`  ❌ ${name}`);
        console.log(`     ${err.message}`);
    }
}
function describe(suite, fn) { console.log(`\n📦 ${suite}`); fn(); }

// 构造一个待处理的活跃 Construction 任务快照
function makeSnapshot() {
    return [
        { id: 'c1', category_id: 'construction', status: 'active', completed: false,
          name: 'Task C1', startDate: '2026-01-01', completionDate: '2026-01-05',
          completionPercentage: 20, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 'c2', category_id: 'construction', status: 'active', completed: true,
          name: 'Task C2', startDate: '2026-01-02', completionDate: '2026-01-06',
          completionPercentage: 100, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 'k1', category_id: 'custom-clearance', status: 'active', completed: false,
          arrivalDate: '2026-02-01', billOfLading: 'BOL-K1', shippingCompany: 'X',
          projectName: 'P', cargoDescription: 'D', created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z' }
    ];
}

// ========== 测试 ==========
describe('快照与视图', () => {
    test('空快照时各分类列表为空', () => {
        const store = new OfflineStore(createMockStorage());
        assert.equal(store.list('construction').length, 0);
        assert.equal(store.list('custom-clearance').length, 0);
    });

    test('mergeSnapshotSubset 会注入 status 字段并按分类+状态过滤', () => {
        const store = new OfflineStore(createMockStorage());
        store.mergeSnapshotSubset('construction', 'active', [
            { id: 'c1', name: 'A', completed: false },
            { id: 'c2', name: 'B', completed: true }
        ]);
        const list = store.list('construction', 'active');
        assert.equal(list.length, 2);
        assert.ok(list.every(t => t.status === 'active'));
    });

    test('list 按状态正确过滤（active / archived / deleted）', () => {
        const store = new OfflineStore(createMockStorage());
        store.mergeSnapshotSubset('construction', 'active', [{ id: 'a', name: 'A', completed: false }]);
        store.mergeSnapshotSubset('construction', 'archived', [{ id: 'b', name: 'B', completed: true, archived_at: '2026-01-01' }]);
        assert.equal(store.list('construction', 'active').length, 1);
        assert.equal(store.list('construction', 'archived').length, 1);
        assert.equal(store.list('construction', 'deleted').length, 0);
    });

    test('getCategories 计算活跃任务的总数与完成数', () => {
        const store = new OfflineStore(createMockStorage());
        store.mergeSnapshotSubset('construction', 'active', [
            { id: 'a', name: 'A', completed: false },
            { id: 'b', name: 'B', completed: true },
            { id: 'c', name: 'C', completed: false }
        ]);
        const cats = store.getCategories();
        const construction = cats.find(c => c.id === 'construction');
        assert.equal(construction.total, 3);
        assert.equal(construction.completed, 1);
        const clearance = cats.find(c => c.id === 'custom-clearance');
        assert.equal(clearance.total, 0);
    });
});

describe('离线写操作（入队 + 视图即时生效）', () => {
    test('create 应生成任务并加入操作队列', () => {
        const store = new OfflineStore(createMockStorage());
        store.mergeSnapshotSubset('construction', 'active', []);
        const task = store.create('construction', {
            name: 'Offline task', startDate: '2026-03-01',
            completionDate: '2026-03-10', completionPercentage: 5
        });
        assert.ok(task.id);
        assert.equal(task.completed, false);
        assert.equal(store.list('construction', 'active').length, 1);
        assert.equal(store.getOps().length, 1);
        assert.equal(store.getOps()[0].kind, 'create');
    });

    test('update 应修改视图中的任务字段', () => {
        const store = new OfflineStore(createMockStorage());
        store.mergeSnapshotSubset('construction', 'active', makeSnapshot().slice(0, 1));
        store.update('c1', { completionPercentage: 80, completed: true });
        const t = store.find('c1');
        assert.equal(t.completionPercentage, 80);
        assert.equal(t.completed, true);
    });

    test('archive/unarchive 改变状态并影响 list', () => {
        const store = new OfflineStore(createMockStorage());
        store.mergeSnapshotSubset('construction', 'active', makeSnapshot().slice(0, 1));
        store.archive('c1');
        assert.equal(store.list('construction', 'active').length, 0);
        assert.equal(store.list('construction', 'archived').length, 1);
        store.unarchive('c1');
        assert.equal(store.list('construction', 'active').length, 1);
        assert.equal(store.list('construction', 'archived').length, 0);
    });

    test('softDelete/restore 改变状态', () => {
        const store = new OfflineStore(createMockStorage());
        store.mergeSnapshotSubset('construction', 'active', makeSnapshot().slice(0, 1));
        store.softDelete('c1');
        assert.equal(store.list('construction', 'deleted').length, 1);
        store.restore('c1');
        assert.equal(store.list('construction', 'active').length, 1);
    });

    test('permanentDelete 从视图移除任务', () => {
        const store = new OfflineStore(createMockStorage());
        store.mergeSnapshotSubset('construction', 'active', makeSnapshot().slice(0, 1));
        store.permanentDelete('c1');
        assert.equal(store.list('construction', 'active').length, 0);
        assert.equal(store.find('c1'), null);
    });

    test('多步操作按顺序生效（create→archive→moveToDeleted→permanent）', () => {
        const store = new OfflineStore(createMockStorage());
        store.mergeSnapshotSubset('construction', 'active', []);
        const t = store.create('construction', { name: 'X', startDate: '2026-01-01', completionDate: '2026-01-02', completionPercentage: 100 });
        store.update(t.id, { completed: true });
        store.archive(t.id);
        store.moveToDeleted(t.id);
        store.permanentDelete(t.id);
        assert.equal(store.find(t.id), null);
        assert.equal(store.getOps().length, 5);
    });
});

describe('操作队列与快照持久化', () => {
    test('操作队列在重新实例化后仍然存在（localStorage 持久化）', () => {
        const storage = createMockStorage();
        const s1 = new OfflineStore(storage);
        s1.mergeSnapshotSubset('construction', 'active', []);
        s1.create('construction', { name: 'Persist', startDate: '2026-01-01', completionDate: '2026-01-02', completionPercentage: 0 });

        const s2 = new OfflineStore(storage);
        assert.equal(s2.hasPendingOps(), true);
        assert.equal(s2.getOps().length, 1);
        assert.equal(s2.list('construction', 'active').length, 1);
    });

    test('clearOps 清空队列', () => {
        const store = new OfflineStore(createMockStorage());
        store.mergeSnapshotSubset('construction', 'active', []);
        store.create('construction', { name: 'X', startDate: '2026-01-01', completionDate: '2026-01-02', completionPercentage: 0 });
        store.clearOps();
        assert.equal(store.hasPendingOps(), false);
    });

    test('discardFirst 移除已重放的前缀', () => {
        const storage = createMockStorage();
        const store = new OfflineStore(storage);
        store.mergeSnapshotSubset('construction', 'active', []);
        store.create('construction', { name: 'A', startDate: '2026-01-01', completionDate: '2026-01-02', completionPercentage: 0 });
        store.create('construction', { name: 'B', startDate: '2026-01-01', completionDate: '2026-01-02', completionPercentage: 0 });
        store.create('construction', { name: 'C', startDate: '2026-01-01', completionDate: '2026-01-02', completionPercentage: 0 });
        assert.equal(store.getOps().length, 3);
        store.discardFirst(2);
        assert.equal(store.getOps().length, 1);
        assert.equal(store.getOps()[0].task.name, 'C');
    });

    test('存在待同步操作时 mergeSnapshotSubset 不会覆盖快照', () => {
        const store = new OfflineStore(createMockStorage());
        store.mergeSnapshotSubset('construction', 'active', []);
        store.create('construction', { name: 'LocalOnly', startDate: '2026-01-01', completionDate: '2026-01-02', completionPercentage: 0 });
        // 试图用服务器数据覆盖，但因为有 pending op 应当被拒绝
        store.mergeSnapshotSubset('construction', 'active', [{ id: 'srv', name: 'FromServer', completed: false }]);
        const active = store.list('construction', 'active');
        // 应仍保留本地创建的任务，且不含服务器数据
        assert.ok(active.find(t => t.name === 'LocalOnly'));
        assert.equal(active.find(t => t.id === 'srv'), undefined);
    });
});

describe('applyOps 纯函数', () => {
    test('空队列时返回原快照', () => {
        const snap = makeSnapshot();
        const out = OfflineStore.applyOps(snap, []);
        assert.equal(out.length, 3);
    });

    test('update 不应篡改 id / category_id / status', () => {
        const snap = makeSnapshot();
        const out = OfflineStore.applyOps(snap, [
            { kind: 'update', id: 'c1', updates: { id: 'hacked', category_id: 'custom-clearance', status: 'deleted', name: 'OK' } }
        ]);
        const t = out.find(x => x.id === 'c1');
        assert.equal(t.category_id, 'construction');
        assert.equal(t.status, 'active');
        assert.equal(t.name, 'OK');
    });
});

// ========== 输出结果 ==========
console.log('\n========================================');
console.log(`📊 OfflineStore 测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 个`);
console.log('========================================\n');

if (failed > 0) {
    console.log('❌ 存在失败的测试！');
    process.exit(1);
} else {
    console.log('🎉 所有 OfflineStore 测试通过！');
}