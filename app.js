// ========== 状态管理 ==========
const CATEGORIES = [
    { id: 'construction', name: 'Construction', icon: '🏗️', description: 'Construction project tasks' },
    { id: 'custom-clearance', name: 'Custom Clearance', icon: '📦', description: 'Custom clearance process tasks' }
];

let activeCategoryId = CATEGORIES[0].id;
let tasks = [];
let projects = [];
let isLoading = false;

// ========== DOM 引用 ==========
const categoryListEl = document.getElementById('category-list');
const categoryTitleEl = document.getElementById('category-title');
const categoryDescEl = document.getElementById('category-desc');
const formSectionEl = document.getElementById('form-section');
const taskList = document.getElementById('task-list');
const statsText = document.getElementById('stats-text');

// ========== 工具函数 ==========
function formatDate(dateString) {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getProjectName(projectId) {
    const p = projects.find(proj => proj.id === projectId);
    return p ? p.name : 'Unknown Project';
}

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

async function fetchProjects() {
    if (activeCategoryId !== 'custom-clearance') return;
    try {
        const response = await MockAPI.getProjects();
        projects = response.data;
    } catch (err) {
        console.error('Failed to load projects:', err);
        showError('Failed to load projects');
    }
}

async function addTask(taskData) {
    try {
        const response = await MockAPI.createTask(activeCategoryId, taskData);
        tasks.push(response.data);
        renderTasks();
        renderForm();
        await renderSidebar();
    } catch (err) {
        console.error('Failed to add task:', err);
        showError('Failed to add task');
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
    renderCategoryHeader();
    await fetchProjects();
    renderForm();
    renderProjectManagement();
    await fetchTasks();
    await renderSidebar();
}

// ========== 项目操作 ==========
async function addProject(name) {
    try {
        const response = await MockAPI.createProject(name);
        projects.push(response.data);
        renderForm();
        renderProjectManagement();
    } catch (err) {
        console.error('Failed to add project:', err);
        showError('Failed to add project');
    }
}

async function removeProject(id) {
    try {
        await MockAPI.deleteProject(id);
        projects = projects.filter(p => p.id !== id);
        renderForm();
        renderProjectManagement();
    } catch (err) {
        console.error('Failed to delete project:', err);
        showError('Failed to delete project');
    }
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

function renderForm() {
    formSectionEl.innerHTML = '';

    if (activeCategoryId === 'construction') {
        formSectionEl.appendChild(createConstructionForm());
    } else {
        formSectionEl.appendChild(createClearanceForm());
    }
}

function createConstructionForm() {
    const form = document.createElement('form');
    form.className = 'task-form';
    form.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label for="name">Task Name</label>
                <input type="text" id="name" placeholder="Enter task name..." required>
            </div>
        </div>
        <div class="form-row two-col">
            <div class="form-group">
                <label for="startDate">Start Date</label>
                <input type="date" id="startDate" required>
            </div>
            <div class="form-group">
                <label for="completionDate">Completion Date</label>
                <input type="date" id="completionDate" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="completionPercentage">Completion Percentage</label>
                <div class="range-row">
                    <input type="range" id="completionPercentage" min="0" max="100" value="0">
                    <span class="range-value" id="rangeValue">0%</span>
                </div>
            </div>
        </div>
        <button type="submit" class="submit-btn">Add Construction Task</button>
    `;

    const rangeInput = form.querySelector('#completionPercentage');
    const rangeValue = form.querySelector('#rangeValue');
    rangeInput.addEventListener('input', (e) => {
        rangeValue.textContent = e.target.value + '%';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        const name = form.querySelector('#name').value.trim();
        const startDate = form.querySelector('#startDate').value;
        const completionDate = form.querySelector('#completionDate').value;
        const completionPercentage = parseInt(form.querySelector('#completionPercentage').value, 10);

        await addTask({ name, startDate, completionDate, completionPercentage });
        form.reset();
        rangeValue.textContent = '0%';
        submitBtn.disabled = false;
    });

    return form;
}

function createClearanceForm() {
    const form = document.createElement('form');
    form.className = 'task-form';

    const projectOptions = projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    form.innerHTML = `
        <div class="form-row two-col">
            <div class="form-group">
                <label for="arrivalDate">Arrival Date</label>
                <input type="date" id="arrivalDate" required>
            </div>
            <div class="form-group">
                <label for="billOfLading">Bill of Lading No.</label>
                <input type="text" id="billOfLading" placeholder="BOL-2026-..." required>
            </div>
        </div>
        <div class="form-row two-col">
            <div class="form-group">
                <label for="shippingCompany">Shipping Company</label>
                <input type="text" id="shippingCompany" placeholder="e.g. Maersk" required>
            </div>
            <div class="form-group">
                <label for="projectId">Project</label>
                <select id="projectId" required>
                    <option value="" disabled selected>Select a project</option>
                    ${projectOptions}
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="cargoDescription">Cargo Description</label>
                <input type="text" id="cargoDescription" placeholder="Describe the cargo..." required>
            </div>
        </div>
        <button type="submit" class="submit-btn">Add Clearance Task</button>
    `;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        const arrivalDate = form.querySelector('#arrivalDate').value;
        const billOfLading = form.querySelector('#billOfLading').value.trim();
        const shippingCompany = form.querySelector('#shippingCompany').value.trim();
        const cargoDescription = form.querySelector('#cargoDescription').value.trim();
        const projectId = form.querySelector('#projectId').value;

        await addTask({ arrivalDate, billOfLading, shippingCompany, cargoDescription, projectId });
        form.reset();
        submitBtn.disabled = false;
    });

    return form;
}

function renderProjectManagement() {
    const panel = document.getElementById('project-management');
    if (!panel) return;

    if (activeCategoryId !== 'custom-clearance') {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';

    const listEl = panel.querySelector('#project-list');
    listEl.innerHTML = '';

    projects.forEach(project => {
        const tag = document.createElement('span');
        tag.className = 'project-tag';
        tag.innerHTML = `${project.name} <button type="button" data-id="${project.id}">×</button>`;
        tag.querySelector('button').addEventListener('click', () => removeProject(project.id));
        listEl.appendChild(tag);
    });

    const input = panel.querySelector('#new-project-name');
    const addBtn = panel.querySelector('#add-project-btn');

    // 防止重复绑定
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);

    newAddBtn.addEventListener('click', () => {
        const name = input.value.trim();
        if (!name) return;
        addProject(name);
        input.value = '';
    });
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
            const card = activeCategoryId === 'construction'
                ? renderConstructionCard(task)
                : renderClearanceCard(task);
            taskList.appendChild(card);
        });
    }

    updateStats();
}

function renderConstructionCard(task) {
    const li = document.createElement('li');
    li.className = 'task-card';

    const top = document.createElement('div');
    top.className = 'task-card-top';

    const checkbox = document.createElement('div');
    checkbox.className = 'task-checkbox' + (task.completed ? ' checked' : '');
    checkbox.addEventListener('click', () => toggleTask(task.id));

    const title = document.createElement('h3');
    title.className = 'task-title' + (task.completed ? ' completed' : '');
    title.textContent = task.name;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Delete task';
    deleteBtn.addEventListener('click', () => deleteTask(task.id));

    top.appendChild(checkbox);
    top.appendChild(title);
    top.appendChild(deleteBtn);

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.innerHTML = `
        <span><strong>Start:</strong> ${formatDate(task.startDate)}</span>
        <span><strong>Completion:</strong> ${formatDate(task.completionDate)}</span>
    `;

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = `
        <div class="progress-fill" style="width: ${task.completionPercentage || 0}%"></div>
        <span class="progress-text">${task.completionPercentage || 0}%</span>
    `;

    li.appendChild(top);
    li.appendChild(meta);
    li.appendChild(progressBar);
    return li;
}

function renderClearanceCard(task) {
    const li = document.createElement('li');
    li.className = 'task-card';

    const top = document.createElement('div');
    top.className = 'task-card-top';

    const checkbox = document.createElement('div');
    checkbox.className = 'task-checkbox' + (task.completed ? ' checked' : '');
    checkbox.addEventListener('click', () => toggleTask(task.id));

    const title = document.createElement('h3');
    title.className = 'task-title' + (task.completed ? ' completed' : '');
    title.textContent = task.billOfLading;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.title = 'Delete task';
    deleteBtn.addEventListener('click', () => deleteTask(task.id));

    top.appendChild(checkbox);
    top.appendChild(title);
    top.appendChild(deleteBtn);

    const meta = document.createElement('div');
    meta.className = 'task-meta clearance-meta';
    meta.innerHTML = `
        <span><strong>Arrival:</strong> ${formatDate(task.arrivalDate)}</span>
        <span><strong>Shipping:</strong> ${task.shippingCompany}</span>
        <span><strong>Project:</strong> ${getProjectName(task.projectId)}</span>
    `;

    const desc = document.createElement('div');
    desc.className = 'task-description';
    desc.textContent = task.cargoDescription;

    li.appendChild(top);
    li.appendChild(meta);
    li.appendChild(desc);
    return li;
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

// ========== 初始化 ==========
async function init() {
    renderCategoryHeader();
    await fetchProjects();
    renderForm();
    renderProjectManagement();
    await fetchTasks();
    await renderSidebar();
}

init();
