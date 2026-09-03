// ========== 数据模型 ==========
const STORAGE_KEY = 'task-tracker-tasks';

let tasks = loadTasks();

function loadTasks() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ========== DOM 引用 ==========
const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');
const statsText = document.getElementById('stats-text');

// ========== 核心操作 ==========
function addTask(text) {
    const task = {
        id: generateId(),
        text: text,
        completed: false
    };
    tasks.push(task);
    saveTasks();
    render();
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    render();
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTasks();
        render();
    }
}

// ========== 渲染 ==========
function render() {
    taskList.innerHTML = '';

    if (tasks.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = '🎉 暂无任务，添加一个开始吧！';
        taskList.appendChild(emptyDiv);
    } else {
        tasks.forEach(task => {
            const li = document.createElement('li');

            // 圆形复选框
            const checkbox = document.createElement('div');
            checkbox.className = 'task-checkbox' + (task.completed ? ' checked' : '');
            checkbox.addEventListener('click', () => toggleTask(task.id));

            // 任务文本
            const span = document.createElement('span');
            span.className = 'task-text' + (task.completed ? ' completed' : '');
            span.textContent = task.text;
            span.addEventListener('click', () => toggleTask(task.id));

            // 删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '✕';
            deleteBtn.title = '删除任务';
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
    statsText.textContent = `已完成 ${completed} / 共 ${total} 个任务`;
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

// 按回车键添加任务
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        addTaskBtn.click();
    }
});

// ========== 初始化 ==========
render();
