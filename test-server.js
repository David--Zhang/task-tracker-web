// test-server.js — 后端测试（DB 层 + HTTP 层）
// 运行方式: node test-server.js（不使用 node --test，避免沙箱 spawn 限制）
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const { initDb, ApiError } = require('./server/db');
const { createApp } = require('./server/index');

// ========== 简易测试框架 ==========
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

async function testAsync(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        console.log(`  ❌ ${name}`);
        console.log(`     ${err.message}`);
    }
}

function describe(suiteName, fn) {
    console.log(`\n📦 ${suiteName}`);
    return fn();
}

// ========== 测试环境 ==========
const TEST_DB_DIR = path.join(__dirname, 'data');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test-server.db');

function freshDb() {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    return initDb(TEST_DB_PATH);
}

function cleanupDb(db) {
    try { db.close(); } catch {}
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
}

// HTTP 请求辅助
async function req(server, method, urlPath, body) {
    const port = server.address().port;
    const options = { method };
    if (body !== undefined) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fetch(`http://127.0.0.1:${port}${urlPath}`, options);
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, body: json, text: json === null ? await Promise.resolve('') : '' };
}

// ========== 主测试流程 ==========
(async () => {
    // ---------- 第一部分：DB 层测试 ----------
    let db = freshDb();

    await describe('种子数据', () => {
        test('应种子 2 个分类', () => {
            const cats = db.getCategories();
            assert.equal(cats.length, 2);
            assert.equal(cats[0].id, 'construction');
            assert.equal(cats[1].id, 'custom-clearance');
        });

        test('Construction 应有 4 个种子任务（2 个已完成）', () => {
            const cats = db.getCategories();
            const construction = cats.find(c => c.id === 'construction');
            assert.equal(construction.total, 4);
            assert.equal(construction.completed, 2);
        });

        test('Custom Clearance 应有 3 个种子任务（1 个已完成）', () => {
            const cats = db.getCategories();
            const clearance = cats.find(c => c.id === 'custom-clearance');
            assert.equal(clearance.total, 3);
            assert.equal(clearance.completed, 1);
        });

        test('种子任务字段应为前端 camelCase 格式', () => {
            const tasks = db.listTasks('construction');
            const t = tasks.find(t => t.id === 'demo-3');
            assert.equal(t.name, 'Schedule site inspection');
            assert.equal(t.startDate, '2026-01-20');
            assert.equal(t.completionDate, '2026-02-01');
            assert.equal(t.completionPercentage, 35);
            assert.equal(t.completed, false);
        });

        test('种子不应包含对方分类的字段', () => {
            const construction = db.listTasks('construction')[0];
            assert.equal(construction.billOfLading, undefined);
            const clearance = db.listTasks('custom-clearance')[0];
            assert.equal(clearance.name, undefined);
            assert.equal(clearance.startDate, undefined);
        });

        test('重新打开数据库不应重复种子', () => {
            db.close();
            db = initDb(TEST_DB_PATH);
            assert.equal(db.listTasks('construction').length, 4);
            assert.equal(db.listTasks('custom-clearance').length, 3);
        });
    });

    await describe('创建任务 (POST)', () => {
        test('创建 Construction 任务应返回完整对象', () => {
            const task = db.createTask('construction', {
                name: 'Pour foundation', startDate: '2026-03-01',
                completionDate: '2026-03-15', completionPercentage: 10
            });
            assert.ok(task.id);
            assert.equal(task.category_id, 'construction');
            assert.equal(task.name, 'Pour foundation');
            assert.equal(task.completionPercentage, 10);
            assert.equal(task.completed, false);
            assert.ok(task.created_at);
        });

        test('创建 Clearance 任务应支持自由文本项目名', () => {
            const task = db.createTask('custom-clearance', {
                arrivalDate: '2026-03-10', billOfLading: 'BOL-2026-099',
                shippingCompany: 'Evergreen', projectName: '任意项目名 123',
                cargoDescription: 'Test cargo'
            });
            assert.equal(task.projectName, '任意项目名 123');
            assert.equal(task.category_id, 'custom-clearance');
        });

        test('缺少必填字段应抛出 400 ApiError', () => {
            assert.throws(
                () => db.createTask('construction', { name: 'No dates' }),
                (err) => err instanceof ApiError && err.code === 400
            );
        });

        test('未知分类应抛出 400', () => {
            assert.throws(
                () => db.createTask('unknown-category', { name: 'x' }),
                (err) => err instanceof ApiError && err.code === 400
            );
        });

        test('完成百分比超范围应抛出 400', () => {
            assert.throws(
                () => db.createTask('construction', {
                    name: 'x', startDate: '2026-01-01',
                    completionDate: '2026-01-02', completionPercentage: 150
                }),
                (err) => err instanceof ApiError && err.code === 400
            );
        });

        test('空白字符串字段应被拒绝', () => {
            assert.throws(
                () => db.createTask('custom-clearance', {
                    arrivalDate: '2026-03-10', billOfLading: '   ',
                    shippingCompany: 'X', projectName: 'Y', cargoDescription: 'Z'
                }),
                (err) => err instanceof ApiError && err.code === 400
            );
        });
    });

    await describe('更新任务 (PATCH)', () => {
        test('部分更新应只改指定字段', () => {
            const before = db.listTasks('construction').find(t => t.id === 'demo-4');
            const after = db.updateTask('demo-4', { completionPercentage: 50 });
            assert.equal(after.completionPercentage, 50);
            assert.equal(after.name, before.name);
            assert.notEqual(after.updated_at, before.updated_at);
        });

        test('切换完成状态应生效', () => {
            const after = db.updateTask('demo-4', { completed: true });
            assert.equal(after.completed, true);
            db.updateTask('demo-4', { completed: false });
        });

        test('白名单外的字段应被忽略（混合更新只应用合法字段）', () => {
            const after = db.updateTask('demo-4', {
                id: 'hacked',
                category_id: 'custom-clearance',
                name: 'Updated name via mixed payload'
            });
            assert.equal(after.id, 'demo-4');                 // id 不可被篡改
            assert.equal(after.category_id, 'construction');  // category_id 不可被篡改
            assert.equal(after.name, 'Updated name via mixed payload'); // 合法字段生效
        });

        test('仅包含白名单外字段应抛出 400', () => {
            assert.throws(
                () => db.updateTask('demo-4', { hacked_field: 'x' }),
                (err) => err instanceof ApiError && err.code === 400
            );
        });

        test('更新不存在的任务应抛出 404', () => {
            assert.throws(
                () => db.updateTask('no-such-id', { name: 'x' }),
                (err) => err instanceof ApiError && err.code === 404
            );
        });

        test('跨分类字段更新应被拒绝（Clearance 字段不能更新到 Construction 任务）', () => {
            assert.throws(
                () => db.updateTask('demo-4', { billOfLading: 'BOL-X' }),
                (err) => err instanceof ApiError && err.code === 400
            );
        });
    });

    await describe('归档 / 软删除 / 恢复流程', () => {
        test('归档未完成任务应抛出 400', () => {
            assert.throws(
                () => db.archiveTask('demo-3'),
                (err) => err instanceof ApiError && err.code === 400 && /completed/.test(err.message)
            );
        });

        test('归档已完成任务应进入 archived 并带时间戳', () => {
            const archived = db.archiveTask('demo-1');
            assert.ok(archived.archived_at);
            assert.equal(db.listTasks('construction').find(t => t.id === 'demo-1'), undefined);
            assert.ok(db.listTasks('construction', 'archived').find(t => t.id === 'demo-1'));
        });

        test('归档后分类统计应减少', () => {
            const construction = db.getCategories().find(c => c.id === 'construction');
            assert.equal(construction.total, 4); // 5 个活跃任务，归档 1 个后剩 4
            assert.equal(construction.completed, 1); // demo-2 仍完成
        });

        test('取消归档应回到活跃列表并清除时间戳', () => {
            const restored = db.unarchiveTask('demo-1');
            assert.equal(restored.archived_at, undefined);
            assert.ok(db.listTasks('construction').find(t => t.id === 'demo-1'));
        });

        test('软删除应进入 deleted 列表', () => {
            const deleted = db.softDeleteTask('demo-4');
            assert.ok(deleted.deleted_at);
            assert.ok(db.listTasks('construction', 'deleted').find(t => t.id === 'demo-4'));
        });

        test('已删除任务不可更新', () => {
            assert.throws(
                () => db.updateTask('demo-4', { name: 'x' }),
                (err) => err instanceof ApiError && err.code === 400
            );
        });

        test('恢复已删除任务应回到活跃列表', () => {
            const restored = db.restoreTask('demo-4');
            assert.equal(restored.deleted_at, undefined);
            assert.ok(db.listTasks('construction').find(t => t.id === 'demo-4'));
        });

        test('归档任务移入已删除列表', () => {
            db.archiveTask('demo-2');
            const moved = db.moveArchivedToDeleted('demo-2');
            assert.ok(moved.deleted_at);
            assert.equal(moved.archived_at, undefined);
            assert.ok(db.listTasks('construction', 'deleted').find(t => t.id === 'demo-2'));
        });

        test('状态迁移路径错误应抛出 400', () => {
            // demo-2 现在是 deleted，不能再归档
            assert.throws(
                () => db.archiveTask('demo-2'),
                (err) => err instanceof ApiError && err.code === 400
            );
            // demo-3 是 active，不能恢复
            assert.throws(
                () => db.restoreTask('demo-3'),
                (err) => err instanceof ApiError && err.code === 400
            );
        });
    });

    await describe('永久删除', () => {
        test('活跃任务不可直接永久删除', () => {
            assert.throws(
                () => db.permanentDeleteTask('demo-3'),
                (err) => err instanceof ApiError && err.code === 400
            );
        });

        test('已删除任务可永久删除', () => {
            db.permanentDeleteTask('demo-2');
            assert.throws(
                () => db.getTask('demo-2'),
                (err) => err instanceof ApiError && err.code === 404
            );
        });

        test('已归档任务可永久删除', () => {
            db.archiveTask('demo-5');
            db.permanentDeleteTask('demo-5');
            assert.throws(
                () => db.getTask('demo-5'),
                (err) => err instanceof ApiError && err.code === 404
            );
        });
    });

    cleanupDb(db);

    // ---------- 第二部分：HTTP 层测试 ----------
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const app = createApp(TEST_DB_PATH);
    const server = await new Promise(resolve => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });

    await describe('HTTP: 分类接口', async () => {
        await testAsync('GET /api/categories 应返回 {data} 信封', async () => {
            const { status, body } = await req(server, 'GET', '/api/categories');
            assert.equal(status, 200);
            assert.ok(Array.isArray(body.data));
            assert.equal(body.data.length, 2);
            assert.equal(body.data[0].id, 'construction');
            assert.equal(typeof body.data[0].total, 'number');
        });
    });

    await describe('HTTP: 任务列表接口', async () => {
        await testAsync('GET /api/tasks?category_id=construction 应返回活跃任务', async () => {
            const { status, body } = await req(server, 'GET', '/api/tasks?category_id=construction');
            assert.equal(status, 200);
            assert.equal(body.data.length, 4);
        });

        await testAsync('GET /api/tasks 缺少 category_id 应返回 400 错误信封', async () => {
            const { status, body } = await req(server, 'GET', '/api/tasks');
            assert.equal(status, 400);
            assert.ok(body.error);
            assert.equal(body.error.code, 400);
        });

        await testAsync('status=archived 过滤应生效', async () => {
            const { body } = await req(server, 'GET', '/api/tasks?category_id=construction&status=archived');
            assert.equal(body.data.length, 0);
        });

        await testAsync('非法 status 应返回 400', async () => {
            const { status } = await req(server, 'GET', '/api/tasks?category_id=construction&status=bogus');
            assert.equal(status, 400);
        });
    });

    await describe('HTTP: 创建与更新', async () => {
        let createdId;

        await testAsync('POST /api/tasks 应返回 201 和任务对象', async () => {
            const { status, body } = await req(server, 'POST', '/api/tasks', {
                category_id: 'construction', name: 'HTTP task',
                startDate: '2026-04-01', completionDate: '2026-04-10', completionPercentage: 5
            });
            assert.equal(status, 201);
            assert.ok(body.data.id);
            assert.equal(body.data.name, 'HTTP task');
            createdId = body.data.id;
        });

        await testAsync('POST 缺少字段应返回 400 错误信封', async () => {
            const { status, body } = await req(server, 'POST', '/api/tasks', {
                category_id: 'construction', name: 'incomplete'
            });
            assert.equal(status, 400);
            assert.ok(body.error.message.includes('startDate'));
        });

        await testAsync('POST 非法 JSON 应返回 400', async () => {
            const { status, body } = await req(server, 'POST', '/api/tasks', '{bad json');
            assert.equal(status, 400);
            assert.ok(body.error);
        });

        await testAsync('PATCH /api/tasks/:id 应切换完成状态', async () => {
            const { status, body } = await req(server, 'PATCH', `/api/tasks/${createdId}`, { completed: true });
            assert.equal(status, 200);
            assert.equal(body.data.completed, true);
        });

        await testAsync('PATCH 不存在的任务应返回 404', async () => {
            const { status, body } = await req(server, 'PATCH', '/api/tasks/nope', { completed: true });
            assert.equal(status, 404);
            assert.equal(body.error.code, 404);
        });
    });

    await describe('HTTP: 完整生命周期（归档 → 删除 → 恢复 → 永久删除）', async () => {
        let id;

        await testAsync('创建测试任务', async () => {
            const { body } = await req(server, 'POST', '/api/tasks', {
                category_id: 'custom-clearance', arrivalDate: '2026-05-01',
                billOfLading: 'BOL-HTTP-1', shippingCompany: 'TestLine',
                projectName: 'HTTP Project', cargoDescription: 'lifecycle test'
            });
            id = body.data.id;
        });

        await testAsync('DELETE /api/tasks/:id 应软删除', async () => {
            const { status } = await req(server, 'DELETE', `/api/tasks/${id}`);
            assert.equal(status, 200);
            const { body } = await req(server, 'GET', '/api/tasks?category_id=custom-clearance&status=deleted');
            assert.ok(body.data.find(t => t.id === id));
        });

        await testAsync('POST /:id/restore 应恢复', async () => {
            const { status } = await req(server, 'POST', `/api/tasks/${id}/restore`);
            assert.equal(status, 200);
            const { body } = await req(server, 'GET', '/api/tasks?category_id=custom-clearance');
            assert.ok(body.data.find(t => t.id === id));
        });

        await testAsync('归档流程：完成 → 归档 → 移入删除 → 永久删除', async () => {
            await req(server, 'PATCH', `/api/tasks/${id}`, { completed: true });
            const { status: s1 } = await req(server, 'POST', `/api/tasks/${id}/archive`);
            assert.equal(s1, 200);
            const { status: s2 } = await req(server, 'POST', `/api/tasks/${id}/move-to-deleted`);
            assert.equal(s2, 200);
            const { status: s3 } = await req(server, 'DELETE', `/api/tasks/${id}/permanent`);
            assert.equal(s3, 200);
            const { status: s4 } = await req(server, 'PATCH', `/api/tasks/${id}`, { completed: false });
            assert.equal(s4, 404); // 已彻底删除
        });

        await testAsync('未完成任务归档应返回 400', async () => {
            const { body } = await req(server, 'POST', '/api/tasks', {
                category_id: 'construction', name: 'cannot archive',
                startDate: '2026-06-01', completionDate: '2026-06-02', completionPercentage: 0
            });
            const { status } = await req(server, 'POST', `/api/tasks/${body.data.id}/archive`);
            assert.equal(status, 400);
        });
    });

    await describe('HTTP: 静态托管与 404', async () => {
        await testAsync('GET / 应返回 index.html', async () => {
            const port = server.address().port;
            const res = await fetch(`http://127.0.0.1:${port}/`);
            const text = await res.text();
            assert.equal(res.status, 200);
            assert.ok(text.includes('Task Tracker'));
            assert.ok(text.includes('api.js'));
        });

        await testAsync('未知 /api 路径应返回 404 错误信封', async () => {
            const { status, body } = await req(server, 'GET', '/api/nope');
            assert.equal(status, 404);
            assert.equal(body.error.code, 404);
        });
    });

    // ========== 清理与汇总 ==========
    await new Promise(resolve => server.close(resolve));
    app.locals.db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

    console.log('\n========================================');
    console.log(`📊 后端测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 个`);
    console.log('========================================\n');

    if (failed > 0) {
        console.log('❌ 存在失败的测试！');
        process.exit(1);
    } else {
        console.log('🎉 所有后端测试通过！');
    }
})();
