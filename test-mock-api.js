// MockAPI 测试 - 验证分类差异化字段和项目管理逻辑
// 用法: node test-mock-api.js

const assert = require('node:assert/strict');

// 移除网络延迟，让测试快速执行
const MockAPI = require('./mock-api.js');
MockAPI.delay = () => Promise.resolve();

// 每个测试前重置数据库到初始状态
const SEED = JSON.parse(JSON.stringify(MockAPI.db));
function resetDb() {
    MockAPI.db = JSON.parse(JSON.stringify(SEED));
}

// ========== 测试运行器 ==========
let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log('  ✅ ' + name);
    } catch (err) {
        failed++;
        failures.push({ name, error: err });
        console.log('  ❌ ' + name);
        console.log('     ' + err.message);
    }
}

function describe(name, fn) {
    console.log('\n📦 ' + name);
    return fn();
}

// ========== 测试用例 ==========

(async () => {

await describe('Construction 任务字段', async () => {
    await test('Construction 任务应包含 name, startDate, completionDate, completionPercentage', async () => {
        resetDb();
        const response = await MockAPI.createTask('construction', {
            name: 'Foundation work',
            startDate: '2026-03-01',
            completionDate: '2026-03-15',
            completionPercentage: 0
        });
        const task = response.data;
        assert.equal(task.name, 'Foundation work');
        assert.equal(task.startDate, '2026-03-01');
        assert.equal(task.completionDate, '2026-03-15');
        assert.equal(task.completionPercentage, 0);
        assert.equal(task.completed, false);
        assert.ok(task.id);
        assert.ok(task.created_at);
    });

    await test('Construction 任务应支持更新完成百分比', async () => {
        resetDb();
        const created = await MockAPI.createTask('construction', {
            name: 'Roofing',
            startDate: '2026-03-01',
            completionDate: '2026-03-10',
            completionPercentage: 0
        });
        const updated = await MockAPI.updateTask(created.data.id, { completionPercentage: 50 });
        assert.equal(updated.data.completionPercentage, 50);
    });

    await test('Construction 任务应支持标记为已完成', async () => {
        resetDb();
        const created = await MockAPI.createTask('construction', {
            name: 'Painting',
            startDate: '2026-03-01',
            completionDate: '2026-03-05',
            completionPercentage: 0
        });
        const updated = await MockAPI.updateTask(created.data.id, { completed: true, completionPercentage: 100 });
        assert.equal(updated.data.completed, true);
        assert.equal(updated.data.completionPercentage, 100);
    });

    await test('Construction 示例数据应包含差异化字段', async () => {
        resetDb();
        const response = await MockAPI.getTasks('construction');
        const task = response.data[0];
        assert.ok(task.name, 'should have name field');
        assert.ok(task.startDate, 'should have startDate field');
        assert.ok(task.completionDate, 'should have completionDate field');
        assert.ok(task.completionPercentage !== undefined, 'should have completionPercentage field');
    });
});

await describe('Custom Clearance 任务字段', async () => {
    await test('Clearance 任务应包含 arrivalDate, billOfLading, shippingCompany, cargoDescription, projectId', async () => {
        resetDb();
        const response = await MockAPI.createTask('custom-clearance', {
            arrivalDate: '2026-03-20',
            billOfLading: 'BOL-2026-999',
            shippingCompany: 'Evergreen',
            cargoDescription: 'Industrial machinery',
            projectId: 'proj-1'
        });
        const task = response.data;
        assert.equal(task.arrivalDate, '2026-03-20');
        assert.equal(task.billOfLading, 'BOL-2026-999');
        assert.equal(task.shippingCompany, 'Evergreen');
        assert.equal(task.cargoDescription, 'Industrial machinery');
        assert.equal(task.projectId, 'proj-1');
        assert.equal(task.completed, false);
    });

    await test('Clearance 示例数据应包含差异化字段', async () => {
        resetDb();
        const response = await MockAPI.getTasks('custom-clearance');
        const task = response.data[0];
        assert.ok(task.arrivalDate, 'should have arrivalDate');
        assert.ok(task.billOfLading, 'should have billOfLading');
        assert.ok(task.shippingCompany, 'should have shippingCompany');
        assert.ok(task.cargoDescription, 'should have cargoDescription');
        assert.ok(task.projectId, 'should have projectId');
    });

    await test('Clearance 任务应不包含 Construction 字段', async () => {
        resetDb();
        const response = await MockAPI.getTasks('custom-clearance');
        const task = response.data[0];
        assert.equal(task.name, undefined, 'should not have name field');
        assert.equal(task.startDate, undefined, 'should not have startDate');
        assert.equal(task.completionPercentage, undefined, 'should not have completionPercentage');
    });

    await test('Construction 任务应不包含 Clearance 字段', async () => {
        resetDb();
        const response = await MockAPI.getTasks('construction');
        const task = response.data[0];
        assert.equal(task.arrivalDate, undefined, 'should not have arrivalDate');
        assert.equal(task.billOfLading, undefined, 'should not have billOfLading');
        assert.equal(task.shippingCompany, undefined, 'should not have shippingCompany');
    });
});

await describe('分类隔离', async () => {
    await test('两类任务应存储在同一数组但 category_id 不同', async () => {
        resetDb();
        await MockAPI.createTask('construction', {
            name: 'New construction task',
            startDate: '2026-03-01',
            completionDate: '2026-03-10',
            completionPercentage: 0
        });
        await MockAPI.createTask('custom-clearance', {
            arrivalDate: '2026-03-20',
            billOfLading: 'BOL-NEW',
            shippingCompany: 'Test',
            cargoDescription: 'Test cargo',
            projectId: 'proj-1'
        });

        const constructionTasks = (await MockAPI.getTasks('construction')).data;
        const clearanceTasks = (await MockAPI.getTasks('custom-clearance')).data;

        const newConstruction = constructionTasks.find(t => t.name === 'New construction task');
        const newClearance = clearanceTasks.find(t => t.billOfLading === 'BOL-NEW');

        assert.ok(newConstruction, 'construction task should exist');
        assert.ok(newClearance, 'clearance task should exist');
        assert.equal(newConstruction.category_id, 'construction');
        assert.equal(newClearance.category_id, 'custom-clearance');
    });

    await test('删除 Construction 任务不应影响 Clearance 任务', async () => {
        resetDb();
        const constructionBefore = (await MockAPI.getTasks('construction')).data;
        const clearanceBefore = (await MockAPI.getTasks('custom-clearance')).data;

        await MockAPI.deleteTask(constructionBefore[0].id);

        const constructionAfter = (await MockAPI.getTasks('construction')).data;
        const clearanceAfter = (await MockAPI.getTasks('custom-clearance')).data;

        assert.equal(constructionAfter.length, constructionBefore.length - 1);
        assert.equal(clearanceAfter.length, clearanceBefore.length);
    });
});

await describe('项目管理', async () => {
    await test('应能获取项目列表', async () => {
        resetDb();
        const response = await MockAPI.getProjects();
        assert.ok(response.data.length >= 2);
        assert.ok(response.data[0].id);
        assert.ok(response.data[0].name);
    });

    await test('应能创建新项目', async () => {
        resetDb();
        const before = (await MockAPI.getProjects()).data;
        const beforeCount = before.length;
        const response = await MockAPI.createProject('Project Gamma');
        assert.equal(response.data.name, 'Project Gamma');
        assert.ok(response.data.id);
        const after = (await MockAPI.getProjects()).data;
        assert.equal(after.length, beforeCount + 1);
    });

    await test('应能删除项目', async () => {
        resetDb();
        const before = (await MockAPI.getProjects()).data;
        const beforeCount = before.length;
        await MockAPI.deleteProject(before[0].id);
        const after = (await MockAPI.getProjects()).data;
        assert.equal(after.length, beforeCount - 1);
    });

    await test('删除不存在的项目应抛出错误', async () => {
        resetDb();
        let threw = false;
        try {
            await MockAPI.deleteProject('non-existent');
        } catch (err) {
            threw = true;
            assert.equal(err.message, 'Project not found');
        }
        assert.ok(threw, 'should throw error for non-existent project');
    });

    await test('新任务应能关联到新建的项目', async () => {
        resetDb();
        const project = await MockAPI.createProject('Project Delta');
        const task = await MockAPI.createTask('custom-clearance', {
            arrivalDate: '2026-04-01',
            billOfLading: 'BOL-DELTA',
            shippingCompany: 'Hapag-Lloyd',
            cargoDescription: 'Electronics',
            projectId: project.data.id
        });
        assert.equal(task.data.projectId, project.data.id);
    });
});

await describe('分类统计', async () => {
    await test('getCategories 应返回每类的 total 和 completed', async () => {
        resetDb();
        const response = await MockAPI.getCategories();
        const categories = response.data;

        const construction = categories.find(c => c.id === 'construction');
        const clearance = categories.find(c => c.id === 'custom-clearance');

        assert.ok(construction.total >= 4, 'construction should have tasks');
        assert.ok(construction.completed >= 2, 'construction should have completed tasks');
        assert.ok(clearance.total >= 3, 'clearance should have tasks');
        assert.ok(clearance.completed >= 1, 'clearance should have completed tasks');
    });
});

// ========== 输出结果 ==========
console.log('\n' + '='.repeat(40));
console.log('📊 MockAPI 测试结果: ' + passed + ' 通过, ' + failed + ' 失败, 共 ' + (passed + failed) + ' 个');
console.log('='.repeat(40));

if (failed > 0) {
    console.log('\n❌ 失败的测试:');
    failures.forEach(f => {
        console.log('  - ' + f.name + ': ' + f.error.message);
    });
    process.exit(1);
} else {
    console.log('\n🎉 所有 MockAPI 测试通过！');
    process.exit(0);
}

})();
