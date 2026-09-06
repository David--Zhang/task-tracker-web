// ========== 状态管理 ==========
const CATEGORIES = [
    { id: 'construction', name: 'Construction', icon: '🏗️', description: 'Construction project tasks' },
    { id: 'custom-clearance', name: 'Custom Clearance', icon: '📦', description: 'Custom clearance process tasks' }
];

let activeCategoryId = CATEGORIES[0].id;
let tasks = [];
let isLoading = false;

// ========== DOM 引用 ==========
const categoryListEl = document.getElementById('category-list');
const categoryTitleEl = document.getElementById('category-title');
const categoryDescEl = document.getElementById('category-desc');
const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');
const statsText = document.getElementById('stats-text');

// ========== 核心操作 (调用 Mock API) ==========
async function fetchTasks() {
    isLoading = true;
    renderTasks();

    try {
        const response = await MockAPI.getTasks(activeCategoryId);
        tasks = response.data;
    } catch (err) {
        console.error('Failed to load tasks:', err);
        showError('Failed to load tasks');
    } finally {
        isLoading = false;
        renderTasks();
    }
}

async function addTask(text) {
    taskInput.disabled = true;
    addTaskBtn.disabled = true;

    try {
        const response = await MockAPI.createTask(activeCategoryId, text);
        tasks.push(response.data);
        taskInput.value = '';
        renderTasks();
        await renderSidebar();
    } catch (err) {
        console.error('Failed to add task:', err);
        showError('Failed to add task');
    } finally {
        taskInput.disabled = false;
        addTaskBtn.disabled = false;
        taskInput.focus();
    }
}

async function deleteTask(id) {
    try {
        await MockAPI.deleteTask(id);
        tasks = tasks.filter(t => t.id !== id);
        renderTasks();
        await renderSidebar();
    } catch (err) {
        console.error('Failed to delete task:', err);
        showError('Failed to delete task');
    }
}

async function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newCompleted = !task.completed;

    try {
        await MockAPI.updateTask(id, { completed: newCompleted });
        task.completed = newCompleted;
        renderTasks();
        await renderSidebar();
    } catch (err) {
        console.error('Failed to toggle task:', err);
        showError('Failed to update task');
    }
}

// ========== 分类切换 ==========
async function switchCategory(categoryId) {
    if (categoryId === activeCategoryId) return;
    activeCategoryId = categoryId;
    taskInput.value = '';
    renderCategoryHeader();
    await fetchTasks();
    await renderSidebar();
}

// ========== 渲染 ==========
async function renderSidebar() {
    categoryListEl.innerHTML = '';

    try {
        const response = await MockAPI.getCategories();
        const categories = response.data;

        categories.forEach(cat => {
            const li = document.createElement('li');
            li.className = 'category-item' + (cat.id === activeCategoryId ? ' active' : '');

            const icon = document.createElement('span');
            icon.className = 'category-icon';
            icon.textContent = cat.icon;

            const name = document.createElement('span');
            name.textContent = cat.name;

            const badge = document.createElement('span');
            badge.className = 'category-badge';
            badge.textContent = `${cat.completed}/${cat.total}`;

            li.appendChild(icon);
            li.appendChild(name);
            li.appendChild(badge);
            li.addEventListener('click', () => switchCategory(cat.id));
            categoryListEl.appendChild(li);
        });
    } catch (err) {
        console.error('Failed to load categories:', err);
        CATEGORIES.forEach(cat => {
            const li = document.createElement('li');
            li.className = 'category-item' + (cat.id === activeCategoryId ? ' active' : '');
            li.innerHTML = `<span class="category-icon">${cat.icon}</span><span>${cat.name}</span>`;
            li.addEventListener('click', () => switchCategory(cat.id));
            categoryListEl.appendChild(li);
        });
    }
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

    if (isLoading) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-state';
        loadingDiv.innerHTML = '<div class="spinner"></div><span>Loading tasks...</span>';
        taskList.appendChild(loadingDiv);
        return;
    }

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

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-toast';
    errorDiv.textContent = '⚠ ' + message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}

// ========== 事件绑定 ==========
addTaskBtn.addEventListener('click', () => {
    const taskText = taskInput.value.trim();
    if (taskText === '') {
        taskInput.focus();
        return;
    }
    addTask(taskText);
});

taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        addTaskBtn.click();
    }
});

// ========== 初始化 ==========
renderCategoryHeader();
fetchTasks();
renderSidebar();
