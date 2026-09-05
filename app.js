// ========== 分类定义 ==========
const CATEGORIES = [
    { id: 'construction', name: 'Construction', icon: '🏗️', description: 'Construction project tasks' },
    { id: 'custom-clearance', name: 'Custom Clearance', icon: '📦', description: 'Custom clearance process tasks' }
];

let activeCategoryId = CATEGORIES[0].id;

// ========== 数据模型 ==========
function getStorageKey(categoryId) {
    return 'task-tracker-tasks-' + categoryId;
}

function loadTasks(categoryId) {
    try {
        const data = localStorage.getItem(getStorageKey(categoryId));
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveTasks(categoryId, tasks) {
    localStorage.setItem(getStorageKey(categoryId), JSON.stringify(tasks));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 当前分类的任务（在切换分类时重新加载）
let tasks = loadTasks(activeCategoryId);

// ========== DOM 引用 ==========
const categoryListEl = document.getElementById('category-list');
const categoryTitleEl = document.getElementById('category-title');
const categoryDescEl = document.getElementById('category-desc');
const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');
const statsText = document.getElementById('stats-text');

// ========== 核心操作 ==========
function addTask(text) {
    const task = { id: generateId(), text, completed: false };
    tasks.push(task);
    saveTasks(activeCategoryId, tasks);
    renderTasks();
    renderSidebar();
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks(activeCategoryId, tasks);
    renderTasks();
    renderSidebar();
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks(activeCategoryId, tasks);
        renderTasks();
        renderSidebar();
    }
}

// ========== 分类切换 ==========
function switchCategory(categoryId) {
    if (categoryId === activeCategoryId) return;
    activeCategoryId = categoryId;
    tasks = loadTasks(activeCategoryId);
    renderSidebar();
    renderCategoryHeader();
    renderTasks();
    taskInput.value = '';
    taskInput.focus();
}

// ========== 渲染 ==========
function renderSidebar() {
    categoryListEl.innerHTML = '';
    CATEGORIES.forEach(cat => {
        const li = document.createElement('li');
        li.className = 'category-item' + (cat.id === activeCategoryId ? ' active' : '');

        const icon = document.createElement('span');
        icon.className = 'category-icon';
        icon.textContent = cat.icon;

        const name = document.createElement('span');
        name.textContent = cat.name;

        const catTasks = loadTasks(cat.id);
        const completed = catTasks.filter(t => t.completed).length;
        const total = catTasks.length;

        const badge = document.createElement('span');
        badge.className = 'category-badge';
        badge.textContent = `${completed}/${total}`;

        li.appendChild(icon);
        li.appendChild(name);
        li.appendChild(badge);
        li.addEventListener('click', () => switchCategory(cat.id));
        categoryListEl.appendChild(li);
    });
}

function renderCategoryHeader() {
    const cat = CATEGORIES.find(c => c.id === activeCategoryId);
    if (cat) {
        categoryTitleEl.textContent = cat.icon + ' ' + cat.name;
        categoryDescEl.textContent = cat.description;
    }
}

function renderTasks() {
    taskList.innerHTML = '';

    if (tasks.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = '🎉 No tasks yet — add one to get started!';
        taskList.appendChild(emptyDiv);
    } else {
        tasks.forEach(task => {
            const li = document.createElement('li');

            const checkbox = document.createElement('div');
            checkbox.className = 'task-checkbox' + (task.completed ? ' checked' : '');
            checkbox.addEventListener('click', () => toggleTask(task.id));

            const span = document.createElement('span');
            span.className = 'task-text' + (task.completed ? ' completed' : '');
            span.textContent = task.text;
            span.addEventListener('click', () => toggleTask(task.id));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '✕';
            deleteBtn.title = 'Delete task';
            deleteBtn.addEventListener('click', () => deleteTask(task.id));

            li.appendChild(checkbox);
            li.appendChild(span);
            li.appendChild(deleteBtn);
            taskList.appendChild(li);
        });
    }

    updateStats();
}

function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    statsText.textContent = `${completed} / ${total} tasks completed`;
}

// ========== 事件绑定 ==========
addTaskBtn.addEventListener('click', () => {
    const taskText = taskInput.value.trim();
    if (taskText === '') {
        taskInput.focus();
        return;
    }
    addTask(taskText);
    taskInput.value = '';
    taskInput.focus();
});

taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        addTaskBtn.click();
    }
});

// ========== 初始化 ==========
renderSidebar();
renderCategoryHeader();
renderTasks();
