const assert = require('node:assert/strict');

// ========== 模拟 localStorage ==========
function createMockStorage() {
    const store = {};
    return {
        getItem(key) { return store[key] || null; },
        setItem(key, value) { store[key] = String(value); },
        removeItem(key) { delete store[key]; },
        clear() { for (const key of Object.keys(store)) delete store[key]; }
    };
}

// ========== 提取核心逻辑用于测试 ==========
function createTaskManager(storage) {
    const STORAGE_KEY = 'task-tracker-tasks';

    function loadTasks() {
        try {
            const data = storage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    }

    function saveTasks(tasks) {
        storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    let tasks = loadTasks();

    return {
        getTasks() { return tasks; },
        addTask(text) {
            const task = { id: generateId(), text, completed: false };
            tasks.push(task);
            saveTasks(tasks);
            return task;
        },
        deleteTask(id) {
            const before = tasks.length;
            tasks = tasks.filter(t => t.id !== id);
            saveTasks(tasks);
            return tasks.length < before;
        },
        toggleTask(id) {
            const task = tasks.find(t => t.id === id);
            if (task) {
                task.completed = !task.completed;
                saveTasks(tasks);
                return true;
            }
            return false;
        },
        getStats() {
            const total = tasks.length;
            const completed = tasks.filter(t => t.completed).length;
            return { total, completed };
        },
        reload() { tasks = loadTasks(); }
    };
}

// ========== 测试运行器 ==========
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        failures.push({ name, error: err });
        console.log(`  ❌ ${name}`);
        console.log(`     ${err.message}`);
    }
}

function describe(name, fn) {
    console.log(`\n📦 ${name}`);
    fn();
}

// ========== 测试用例 ==========

let storage, manager;
function setup() {
    storage = createMockStorage();
    manager = createTaskManager(storage);
}

describe('添加任务', () => {
    test('应该成功添加一个新任务', () => {
        setup();
        const task = manager.addTask('买菜');
        assert.equal(task.text, '买菜');
        assert.equal(task.completed, false);
        assert.ok(task.id);
        assert.equal(manager.getTasks().length, 1);
    });

    test('应该可以添加多个任务', () => {
        setup();
        manager.addTask('买菜');
        manager.addTask('写代码');
        manager.addTask('运动');
        assert.equal(manager.getTasks().length, 3);
    });

    test('每个任务应该有唯一的 ID', () => {
        setup();
        const t1 = manager.addTask('任务1');
        const t2 = manager.addTask('任务2');
        assert.notEqual(t1.id, t2.id);
    });
});

describe('删除任务', () => {
    test('应该成功删除指定任务', () => {
        setup();
        const task = manager.addTask('要删除的任务');
        assert.equal(manager.getTasks().length, 1);
        const result = manager.deleteTask(task.id);
        assert.equal(result, true);
        assert.equal(manager.getTasks().length, 0);
    });

    test('删除不存在的任务应该返回 false', () => {
        setup();
        manager.addTask('保留的任务');
        const result = manager.deleteTask('non-existent-id');
        assert.equal(result, false);
        assert.equal(manager.getTasks().length, 1);
    });

    test('删除一个任务不应影响其他任务', () => {
        setup();
        const t1 = manager.addTask('任务1');
        const t2 = manager.addTask('任务2');
        const t3 = manager.addTask('任务3');
        manager.deleteTask(t2.id);
        const remaining = manager.getTasks();
        assert.equal(remaining.length, 2);
        assert.equal(remaining[0].id, t1.id);
        assert.equal(remaining[1].id, t3.id);
    });
});

describe('切换任务完成状态', () => {
    test('应该将任务标记为已完成', () => {
        setup();
        const task = manager.addTask('待完成的任务');
        assert.equal(task.completed, false);
        manager.toggleTask(task.id);
        assert.equal(manager.getTasks()[0].completed, true);
    });

    test('再次切换应该恢复为未完成', () => {
        setup();
        const task = manager.addTask('任务');
        manager.toggleTask(task.id);
        assert.equal(manager.getTasks()[0].completed, true);
        manager.toggleTask(task.id);
        assert.equal(manager.getTasks()[0].completed, false);
    });

    test('切换不存在的任务应该返回 false', () => {
        setup();
        const result = manager.toggleTask('non-existent-id');
        assert.equal(result, false);
    });
});

describe('数据持久化 (localStorage)', () => {
    test('添加任务后应保存到 localStorage', () => {
        setup();
        manager.addTask('持久化测试');
        const stored = JSON.parse(storage.getItem('task-tracker-tasks'));
        assert.equal(stored.length, 1);
        assert.equal(stored[0].text, '持久化测试');
    });

    test('删除任务后应更新 localStorage', () => {
        setup();
        const task = manager.addTask('临时任务');
        manager.deleteTask(task.id);
        const stored = JSON.parse(storage.getItem('task-tracker-tasks'));
        assert.equal(stored.length, 0);
    });

    test('切换完成状态后应更新 localStorage', () => {
        setup();
        const task = manager.addTask('任务');
        manager.toggleTask(task.id);
        const stored = JSON.parse(storage.getItem('task-tracker-tasks'));
        assert.equal(stored[0].completed, true);
    });

    test('重新加载后应恢复保存的任务', () => {
        setup();
        manager.addTask('任务A');
        manager.addTask('任务B');
        const manager2 = createTaskManager(storage);
        assert.equal(manager2.getTasks().length, 2);
        assert.equal(manager2.getTasks()[0].text, '任务A');
        assert.equal(manager2.getTasks()[1].text, '任务B');
    });

    test('localStorage 为空时应返回空数组', () => {
        setup();
        const manager2 = createTaskManager(storage);
        assert.equal(manager2.getTasks().length, 0);
    });
});

describe('任务统计', () => {
    test('空任务列表时统计应为 0/0', () => {
        setup();
        const stats = manager.getStats();
        assert.equal(stats.total, 0);
        assert.equal(stats.completed, 0);
    });

    test('应正确计算完成任务数量', () => {
        setup();
        manager.addTask('任务1');
        const t2 = manager.addTask('任务2');
        manager.addTask('任务3');
        manager.toggleTask(t2.id);
        const stats = manager.getStats();
        assert.equal(stats.total, 3);
        assert.equal(stats.completed, 1);
    });

    test('所有任务完成时统计应为 3/3', () => {
        setup();
        const t1 = manager.addTask('任务1');
        const t2 = manager.addTask('任务2');
        const t3 = manager.addTask('任务3');
        manager.toggleTask(t1.id);
        manager.toggleTask(t2.id);
        manager.toggleTask(t3.id);
        const stats = manager.getStats();
        assert.equal(stats.total, 3);
        assert.equal(stats.completed, 3);
    });
});

// ========== 输出结果 ==========
console.log(`\n${'='.repeat(40)}`);
console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 个`);
console.log(`${'='.repeat(40)}`);

if (failed > 0) {
    console.log('\n❌ 失败的测试:');
    failures.forEach(f => {
        console.log(`  - ${f.name}: ${f.error.message}`);
    });
    process.exit(1);
} else {
    console.log('\n🎉 所有测试通过！');
    process.exit(0);
}
