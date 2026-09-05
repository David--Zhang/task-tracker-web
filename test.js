const assert = require('node:assert/strict');

// ========== Mock localStorage ==========
function createMockStorage() {
    const store = {};
    return {
        getItem(key) { return store[key] || null; },
        setItem(key, value) { store[key] = String(value); },
        removeItem(key) { delete store[key]; },
        clear() { for (const key of Object.keys(store)) delete store[key]; }
    };
}

// ========== Task Manager (mirrors app.js core logic, supports categories) ==========
function createTaskManager(storage, categoryId) {
    function getStorageKey(id) {
        return 'task-tracker-tasks-' + id;
    }

    function loadTasks(id) {
        try {
            const data = storage.getItem(getStorageKey(id));
            return data ? JSON.parse(data) : [];
        } catch { return []; }
    }

    function saveTasks(id, tasks) {
        storage.setItem(getStorageKey(id), JSON.stringify(tasks));
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    let activeCategoryId = categoryId;
    let tasks = loadTasks(activeCategoryId);

    return {
        getTasks() { return tasks; },
        getActiveCategoryId() { return activeCategoryId; },

        switchCategory(newCategoryId) {
            activeCategoryId = newCategoryId;
            tasks = loadTasks(activeCategoryId);
        },

        addTask(text) {
            const task = { id: generateId(), text, completed: false };
            tasks.push(task);
            saveTasks(activeCategoryId, tasks);
            return task;
        },

        deleteTask(id) {
            const before = tasks.length;
            tasks = tasks.filter(t => t.id !== id);
            saveTasks(activeCategoryId, tasks);
            return tasks.length < before;
        },

        toggleTask(id) {
            const task = tasks.find(t => t.id === id);
            if (task) {
                task.completed = !task.completed;
                saveTasks(activeCategoryId, tasks);
                return true;
            }
            return false;
        },

        getStats() {
            const total = tasks.length;
            const completed = tasks.filter(t => t.completed).length;
            return { total, completed };
        },

        getCategoryStats(catId) {
            const catTasks = loadTasks(catId);
            return {
                total: catTasks.length,
                completed: catTasks.filter(t => t.completed).length
            };
        }
    };
}

// ========== Test Runner ==========
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
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
    fn();
}

// ========== Test Cases ==========

let storage, manager;
function setup() {
    storage = createMockStorage();
    manager = createTaskManager(storage, 'construction');
}

describe('Add Task', () => {
    test('should add a new task successfully', () => {
        setup();
        const task = manager.addTask('Buy groceries');
        assert.equal(task.text, 'Buy groceries');
        assert.equal(task.completed, false);
        assert.ok(task.id);
        assert.equal(manager.getTasks().length, 1);
    });

    test('should add multiple tasks', () => {
        setup();
        manager.addTask('Task 1');
        manager.addTask('Task 2');
        manager.addTask('Task 3');
        assert.equal(manager.getTasks().length, 3);
    });

    test('each task should have a unique ID', () => {
        setup();
        const t1 = manager.addTask('Task 1');
        const t2 = manager.addTask('Task 2');
        assert.notEqual(t1.id, t2.id);
    });
});

describe('Delete Task', () => {
    test('should delete the specified task', () => {
        setup();
        const task = manager.addTask('To delete');
        assert.equal(manager.getTasks().length, 1);
        const result = manager.deleteTask(task.id);
        assert.equal(result, true);
        assert.equal(manager.getTasks().length, 0);
    });

    test('should return false for non-existent task', () => {
        setup();
        manager.addTask('Keep this');
        const result = manager.deleteTask('non-existent-id');
        assert.equal(result, false);
        assert.equal(manager.getTasks().length, 1);
    });

    test('deleting one task should not affect others', () => {
        setup();
        const t1 = manager.addTask('Task 1');
        const t2 = manager.addTask('Task 2');
        const t3 = manager.addTask('Task 3');
        manager.deleteTask(t2.id);
        const remaining = manager.getTasks();
        assert.equal(remaining.length, 2);
        assert.equal(remaining[0].id, t1.id);
        assert.equal(remaining[1].id, t3.id);
    });
});

describe('Toggle Task Completion', () => {
    test('should mark task as completed', () => {
        setup();
        const task = manager.addTask('To complete');
        assert.equal(task.completed, false);
        manager.toggleTask(task.id);
        assert.equal(manager.getTasks()[0].completed, true);
    });

    test('toggling again should mark as incomplete', () => {
        setup();
        const task = manager.addTask('Task');
        manager.toggleTask(task.id);
        assert.equal(manager.getTasks()[0].completed, true);
        manager.toggleTask(task.id);
        assert.equal(manager.getTasks()[0].completed, false);
    });

    test('should return false for non-existent task', () => {
        setup();
        const result = manager.toggleTask('non-existent-id');
        assert.equal(result, false);
    });
});

describe('Data Persistence (localStorage)', () => {
    test('should save tasks to localStorage after adding', () => {
        setup();
        manager.addTask('Persistence test');
        const stored = JSON.parse(storage.getItem('task-tracker-tasks-construction'));
        assert.equal(stored.length, 1);
        assert.equal(stored[0].text, 'Persistence test');
    });

    test('should update localStorage after deleting', () => {
        setup();
        const task = manager.addTask('Temp task');
        manager.deleteTask(task.id);
        const stored = JSON.parse(storage.getItem('task-tracker-tasks-construction'));
        assert.equal(stored.length, 0);
    });

    test('should update localStorage after toggling', () => {
        setup();
        const task = manager.addTask('Task');
        manager.toggleTask(task.id);
        const stored = JSON.parse(storage.getItem('task-tracker-tasks-construction'));
        assert.equal(stored[0].completed, true);
    });

    test('should restore tasks after reload', () => {
        setup();
        manager.addTask('Task A');
        manager.addTask('Task B');
        const manager2 = createTaskManager(storage, 'construction');
        assert.equal(manager2.getTasks().length, 2);
        assert.equal(manager2.getTasks()[0].text, 'Task A');
        assert.equal(manager2.getTasks()[1].text, 'Task B');
    });

    test('should return empty array when localStorage is empty', () => {
        setup();
        const manager2 = createTaskManager(storage, 'construction');
        assert.equal(manager2.getTasks().length, 0);
    });
});

describe('Task Stats', () => {
    test('should show 0/0 when empty', () => {
        setup();
        const stats = manager.getStats();
        assert.equal(stats.total, 0);
        assert.equal(stats.completed, 0);
    });

    test('should count completed tasks correctly', () => {
        setup();
        manager.addTask('Task 1');
        const t2 = manager.addTask('Task 2');
        manager.addTask('Task 3');
        manager.toggleTask(t2.id);
        const stats = manager.getStats();
        assert.equal(stats.total, 3);
        assert.equal(stats.completed, 1);
    });

    test('should show 3/3 when all completed', () => {
        setup();
        const t1 = manager.addTask('Task 1');
        const t2 = manager.addTask('Task 2');
        const t3 = manager.addTask('Task 3');
        manager.toggleTask(t1.id);
        manager.toggleTask(t2.id);
        manager.toggleTask(t3.id);
        const stats = manager.getStats();
        assert.equal(stats.total, 3);
        assert.equal(stats.completed, 3);
    });
});

// ========== Category Isolation Tests (NEW) ==========

describe('Category Isolation', () => {
    test('tasks in different categories should be independent', () => {
        setup();
        // Add tasks to construction
        manager.addTask('Construction task 1');
        manager.addTask('Construction task 2');

        // Switch to custom-clearance
        manager.switchCategory('custom-clearance');
        assert.equal(manager.getTasks().length, 0, 'Custom clearance should start empty');

        // Add task to custom-clearance
        manager.addTask('Clearance task 1');
        assert.equal(manager.getTasks().length, 1);

        // Switch back to construction
        manager.switchCategory('construction');
        assert.equal(manager.getTasks().length, 2, 'Construction should still have 2 tasks');
        assert.equal(manager.getTasks()[0].text, 'Construction task 1');
    });

    test('each category should use a separate localStorage key', () => {
        setup();
        manager.addTask('Construction only');

        manager.switchCategory('custom-clearance');
        manager.addTask('Clearance only');

        const constructionStored = JSON.parse(storage.getItem('task-tracker-tasks-construction'));
        const clearanceStored = JSON.parse(storage.getItem('task-tracker-tasks-custom-clearance'));

        assert.equal(constructionStored.length, 1);
        assert.equal(constructionStored[0].text, 'Construction only');
        assert.equal(clearanceStored.length, 1);
        assert.equal(clearanceStored[0].text, 'Clearance only');
    });

    test('deleting in one category should not affect the other', () => {
        setup();
        const t1 = manager.addTask('Construction task');
        manager.switchCategory('custom-clearance');
        const t2 = manager.addTask('Clearance task');

        // Delete from custom-clearance
        manager.deleteTask(t2.id);
        assert.equal(manager.getTasks().length, 0);

        // Switch back, construction should be intact
        manager.switchCategory('construction');
        assert.equal(manager.getTasks().length, 1);
        assert.equal(manager.getTasks()[0].id, t1.id);
    });

    test('toggling completion in one category should not affect the other', () => {
        setup();
        const t1 = manager.addTask('Construction task');
        manager.switchCategory('custom-clearance');
        const t2 = manager.addTask('Clearance task');
        manager.toggleTask(t2.id);

        // Check clearance task is completed
        assert.equal(manager.getTasks()[0].completed, true);

        // Switch to construction, task should still be incomplete
        manager.switchCategory('construction');
        assert.equal(manager.getTasks()[0].completed, false);
    });

    test('stats should be independent per category', () => {
        setup();
        manager.addTask('C1');
        const c2 = manager.addTask('C2');
        manager.toggleTask(c2.id);

        manager.switchCategory('custom-clearance');
        manager.addTask('CC1');
        manager.addTask('CC2');
        manager.addTask('CC3');

        // Construction stats: 1/2
        const constStats = manager.getCategoryStats('construction');
        assert.equal(constStats.total, 2);
        assert.equal(constStats.completed, 1);

        // Custom clearance stats: 0/3
        const clearStats = manager.getCategoryStats('custom-clearance');
        assert.equal(clearStats.total, 3);
        assert.equal(clearStats.completed, 0);
    });

    test('switching to the same category should not lose data', () => {
        setup();
        manager.addTask('Task A');
        manager.addTask('Task B');
        manager.switchCategory('construction');
        assert.equal(manager.getTasks().length, 2);
    });
});

// ========== Output Results ==========
console.log('\n' + '='.repeat(40));
console.log('📊 Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
console.log('='.repeat(40));

if (failed > 0) {
    console.log('\n❌ Failed tests:');
    failures.forEach(f => {
        console.log('  - ' + f.name + ': ' + f.error.message);
    });
    process.exit(1);
} else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
}
