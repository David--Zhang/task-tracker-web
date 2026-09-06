// ========== 状态管理 ==========
const CATEGORIES = [
    { id: 'construction', name: 'Construction', icon: '🏗️', description: 'Construction project tasks' },
    { id: 'custom-clearance', name: 'Custom Clearance', icon: '📦', description: 'Custom clearance process tasks' }
];

let activeCategoryId = CATEGORIES[0].id;
let tasks = [];
let archivedTasks = [];
let deletedTasks = [];
let isLoading = false;
let openSections = new Set();

// 搜索与批量操作状态
let searchTerm = '';
let selectedTaskIds = new Set();

// ========== DOM 引用 ==========
const categoryListEl = document.getElementById('category-list');
const categoryTitleEl = document.getElementById('category-title');
const categoryDescEl = document.getElementById('category-desc');
const formSectionEl = document.getElementById('form-section');
const taskList = document.getElementById('task-list');
const statsText = document.getElementById('stats-text');
const archivedSection = document.getElementById('archived-section');
const archivedContent = document.getElementById('archived-content');
const archivedList = document.getElementById('archived-list');
const archivedCount = document.getElementById('archived-count');
const deletedSection = document.getElementById('deleted-section');
const deletedContent = document.getElementById('deleted-content');
const deletedList = document.getElementById('deleted-list');
const deletedCount = document.getElementById('deleted-count');
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const editModalTitle = document.getElementById('edit-modal-title');
const confirmModal = document.getElementById('confirm-modal');
const confirmSource = document.getElementById('confirm-source');
const confirmDeleteBtn = document.getElementById('confirm-permanent-delete-btn');
const toolBar = document.getElementById('toolbar');
const searchInput = document.getElementById('search-input');
const exportCsvBtn = document.getElementById('export-csv-btn');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const batchActionbar = document.getElementById('batch-actionbar');

// ========== 工具函数 ==========
function formatDate(dateString) {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ========== 排序函数 ==========
function sortByDate(arr, dateField) {
    return [...arr].sort((a, b) => {
        if (!a[dateField] && !b[dateField]) return 0;
        if (!a[dateField]) return 1;
        if (!b[dateField]) return -1;
        return new Date(a[dateField]) - new Date(b[dateField]);
    });
}

function getSortedTasks(taskArray) {
    const dateField = activeCategoryId === 'construction' ? 'startDate' : 'arrivalDate';
    return sortByDate(taskArray, dateField);
}

// ========== 搜索过滤 ==========
function matchesSearch(task, term) {
    if (!term || term.trim() === '') return true;
    const lowerTerm = term.toLowerCase().trim();

    if (activeCategoryId === 'construction') {
        return (
            (task.name || '').toLowerCase().includes(lowerTerm) ||
            (task.startDate || '').includes(term.trim()) ||
            (task.completionDate || '').includes(term.trim()) ||
            String(task.completionPercentage || '').includes(lowerTerm)
        );
    } else {
        return (
            (task.billOfLading || '').toLowerCase().includes(lowerTerm) ||
            (task.arrivalDate || '').includes(term.trim()) ||
            (task.shippingCompany || '').toLowerCase().includes(lowerTerm) ||
            (task.projectName || '').toLowerCase().includes(lowerTerm) ||
            (task.cargoDescription || '').toLowerCase().includes(lowerTerm)
        );
    }
}

function filteredTasks(taskArray) {
    return taskArray.filter(t => matchesSearch(t, searchTerm));
}

// ========== 核心操作 (调用 Mock API) ==========
async function fetchData() {
    isLoading = true;
    renderAll();

    try {
        const [tasksRes, archivedRes, deletedRes] = await Promise.all([
            MockAPI.getTasks(activeCategoryId),
            MockAPI.getArchived(activeCategoryId),
            MockAPI.getDeleted(activeCategoryId)
        ]);
        tasks = tasksRes.data;
        archivedTasks = archivedRes.data;
        deletedTasks = deletedRes.data;
    } catch (err) {
        console.error('Failed to load data:', err);
        showError('Failed to load data');
    } finally {
        isLoading = false;
        renderAll();
    }
}

async function addTask(taskData) {
    try {
        const response = await MockAPI.createTask(activeCategoryId, taskData);
        tasks.push(response.data);
        renderActiveList();
        renderForm();
        await renderSidebar();
    } catch (err) {
        console.error('Failed to add task:', err);
        showError('Failed to add task');
    }
}

// ========== 编辑任务 ==========
async function startEdit(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const isConstruction = activeCategoryId === 'construction';
    editModalTitle.textContent = '✏️ Edit Task';
    editForm.innerHTML = '';
    document.getElementById('edit-task-id').value = id;

    const wrapper = document.createElement('div');
    wrapper.className = 'edit-form';
    wrapper.innerHTML = `<input type="hidden" value="${id}" id="edit-task-id-hidden">`;

    if (isConstruction) {
        wrapper.innerHTML += `
            <div class="form-group">
                <label>Task Name</label>
                <input type="text" id="edit-name" value="${task.name || ''}" required>
            </div>
            <div class="form-row two-col">
                <div class="form-group">
                    <label>Start Date</label>
                    <input type="date" id="edit-startDate" value="${task.startDate || ''}" required>
                </div>
                <div class="form-group">
                    <label>Completion Date</label>
                    <input type="date" id="edit-completionDate" value="${task.completionDate || ''}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Completion Percentage</label>
                <div class="range-row">
                    <input type="range" id="edit-completionPercentage" min="0" max="100" value="${task.completionPercentage || 0}">
                    <span class="range-value" id="edit-rangeValue">${task.completionPercentage || 0}%</span>
                </div>
            </div>
            <button type="submit" class="submit-btn edit-submit-btn">Save Changes</button>
        `;
    } else {
        wrapper.innerHTML += `
            <div class="form-row two-col">
                <div class="form-group">
                    <label>Arrival Date</label>
                    <input type="date" id="edit-arrivalDate" value="${task.arrivalDate || ''}" required>
                </div>
                <div class="form-group">
                    <label>Bill of Lading No.</label>
                    <input type="text" id="edit-billOfLading" value="${task.billOfLading || ''}" required>
                </div>
            </div>
            <div class="form-row two-col">
                <div class="form-group">
                    <label>Shipping Company</label>
                    <input type="text" id="edit-shippingCompany" value="${task.shippingCompany || ''}" required>
                </div>
                <div class="form-group">
                    <label>Project Name</label>
                    <input type="text" id="edit-projectName" value="${task.projectName || ''}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Cargo Description</label>
                <input type="text" id="edit-cargoDescription" value="${task.cargoDescription || ''}" required>
            </div>
            <button type="submit" class="submit-btn edit-submit-btn">Save Changes</button>
        `;
    }

    editForm.appendChild(wrapper);

    // Range input event
    const rangeInput = wrapper.querySelector('#edit-completionPercentage');
    const rangeValue = wrapper.querySelector('#edit-rangeValue');
    if (rangeInput && rangeValue) {
        rangeInput.addEventListener('input', e => rangeValue.textContent = e.target.value + '%');
    }

    editForm.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = wrapper.querySelector('.edit-submit-btn');
        submitBtn.disabled = true;

        const updates = {};
        if (isConstruction) {
            updates.name = wrapper.querySelector('#edit-name').value.trim();
            updates.startDate = wrapper.querySelector('#edit-startDate').value;
            updates.completionDate = wrapper.querySelector('#edit-completionDate').value;
            updates.completionPercentage = parseInt(wrapper.querySelector('#edit-completionPercentage').value, 10);
        } else {
            updates.arrivalDate = wrapper.querySelector('#edit-arrivalDate').value;
            updates.billOfLading = wrapper.querySelector('#edit-billOfLading').value.trim();
            updates.shippingCompany = wrapper.querySelector('#edit-shippingCompany').value.trim();
            updates.projectName = wrapper.querySelector('#edit-projectName').value.trim();
            updates.cargoDescription = wrapper.querySelector('#edit-cargoDescription').value.trim();
        }

        try {
            await MockAPI.updateTask(id, updates);
            const idx = tasks.findIndex(t => t.id === id);
            if (idx !== -1) Object.assign(tasks[idx], updates);
            renderActiveList();
            closeModal(editModal);
        } catch (err) {
            console.error('Failed to update task:', err);
            showError('Failed to update task');
        } finally {
            submitBtn.disabled = false;
        }
    };

    openModal(editModal);
}

// ========== 归档已完成任务 ==========
async function archiveTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task || !task.completed) return;

    try {
        await MockAPI.archiveTask(id);
        tasks = tasks.filter(t => t.id !== id);
        archivedTasks.push(task);
        renderAll();
    } catch (err) {
        console.error('Failed to archive task:', err);
        showError('Failed to archive task');
    }
}

// ========== 批量归档 ==========
async function batchArchive(ids) {
    let success = 0;
    for (const id of ids) {
        const task = tasks.find(t => t.id === id);
        if (task && task.completed) {
            try {
                await MockAPI.archiveTask(id);
                success++;
            } catch {}
        }
    }
    if (success > 0) {
        tasks = tasks.filter(t => !ids.includes(t.id) || !t.completed);
        renderedSelectedIds.clear();
        showToast(`${success} task(s) archived`);
        renderAll();
        await renderSidebar();
    }
}

// ========== 批量删除 ==========
async function batchDelete(ids) {
    for (const id of ids) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            try {
                await MockAPI.deleteTask(id);
                deletedTasks.push({ ...task, deleted_at: new Date().toISOString() });
            } catch {}
        }
    }
    tasks = tasks.filter(t => !ids.includes(t.id));
    renderedSelectedIds.clear();
    showToast(`${ids.length} task(s) moved to Deleted`);
    renderAll();
    await renderSidebar();
}

// ========== 从归档恢复任务 ==========
async function restoreFromArchived(id) {
    try {
        await MockAPI.unarchiveTask(id);
        const task = archivedTasks.find(t => t.id === id);
        archivedTasks = archivedTasks.filter(t => t.id !== id);
        tasks.push(task);
        renderAll();
    } catch (err) {
        console.error('Failed to restore task:', err);
        showError('Failed to restore task');
    }
}

// ========== 从归档移到删除 ==========
async function moveToDeletedFromArchived(id) {
    try {
        await MockAPI.deleteFromArchived(id);
        const task = archivedTasks.find(t => t.id === id);
        archivedTasks = archivedTasks.filter(t => t.id !== id);
        deletedTasks.push({ ...task, deleted_at: new Date().toISOString() });
        renderAll();
    } catch (err) {
        console.error('Failed to delete from archived:', err);
        showError('Failed to move task to deleted');
    }
}

// ========== 软删除 ==========
async function softDeleteTask(id) {
    try {
        await MockAPI.deleteTask(id);
        const task = tasks.find(t => t.id === id);
        tasks = tasks.filter(t => t.id !== id);
        deletedTasks.push({ ...task, deleted_at: new Date().toISOString() });
        renderAll();
    } catch (err) {
        console.error('Failed to delete task:', err);
        showError('Failed to delete task');
    }
}

// ========== 从已删除恢复 ==========
async function restoreFromDeleted(id) {
    try {
        await MockAPI.undeleteTask(id);
        const task = deletedTasks.find(t => t.id === id);
        deletedTasks = deletedTasks.filter(t => t.id !== id);
        tasks.push(task);
        renderAll();
    } catch (err) {
        console.error('Failed to restore deleted task:', err);
        showError('Failed to restore task');
    }
}

// ========== 永久删除（确认中处理） ==========
async function handlePermanentDelete(type, id) {
    try {
        await MockAPI.permanentDelete(type, id);
        if (type === 'archived') {
            archivedTasks = archivedTasks.filter(t => t.id !== id);
        } else {
            deletedTasks = deletedTasks.filter(t => t.id !== id);
        }
        closeModal(confirmModal);
        renderAll();
    } catch (err) {
        console.error('Failed to permanently delete:', err);
        showError('Failed to permanently delete');
    }
}

// ========== 导出CSV ==========
function exportToCSV() {
    if (tasks.length === 0) {
        showToast('No tasks to export');
        return;
    }

    let csv = '';
    let headers = [];

    if (activeCategoryId === 'construction') {
        headers = ['Name', 'Start Date', 'Completion Date', 'Progress (%)', 'Completed'];
        csv = headers.join(',') + '\n';
        tasks.forEach(task => {
            const row = [
                `"${(task.name || '').replace(/"/g, '""')}"`,
                task.startDate || '',
                task.completionDate || '',
                task.completionPercentage || 0,
                task.completed ? 'Yes' : 'No'
            ];
            csv += row.join(',') + '\n';
        });
    } else {
        headers = ['Bill Of Lading', 'Arrival Date', 'Shipping Company', 'Project Name', 'Cargo Description', 'Completed'];
        csv = headers.join(',') + '\n';
        tasks.forEach(task => {
            const row = [
                `"${(task.billOfLading || '').replace(/"/g, '""')}"`,
                task.arrivalDate || '',
                `"${(task.shippingCompany || '').replace(/"/g, '""')}"`,
                `"${(task.projectName || '').replace(/"/g, '""')}"`,
                `"${(task.cargoDescription || '').replace(/"/g, '""')}"`,
                task.completed ? 'Yes' : 'No'
            ];
            csv += row.join(',') + '\n';
        });
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${activeCategoryId}_tasks_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`Exported ${tasks.length} task(s)`);
}

// ========== 切换折叠区域 ==========
function toggleSection(name) {
    if (openSections.has(name)) {
        openSections.delete(name);
        if (name === 'archived') {
            archivedContent.classList.remove('open');
            archivedSection.querySelector('.toggle-icon').classList.remove('open');
        } else {
            deletedContent.classList.remove('open');
            deletedSection.querySelector('.toggle-icon').classList.remove('open');
        }
    } else {
        openSections.add(name);
        if (name === 'archived') {
            archivedContent.classList.add('open');
            archivedSection.querySelector('.toggle-icon').classList.add('open');
        } else {
            deletedContent.classList.add('open');
            deletedSection.querySelector('.toggle-icon').classList.add('open');
        }
    }
}

// ========== 模态框 ==========
function openModal(modal) {
    modal.style.display = 'flex';
}

function closeModal(modal) {
    modal.style.display = 'none';
    if (modal === editModal) {
        editForm.onsubmit = null;
        editForm.innerHTML = '';
    }
    if (modal === confirmModal) {
        confirmDeleteBtn.onclick = null;
    }
}

window.toggleSection = toggleSection;
window.closeEditModal = () => closeModal(editModal);

function showConfirmDelete(type, sourceLabel) {
    confirmSource.textContent = sourceLabel;
    confirmDeleteBtn.onclick = () => handlePermanentDelete(type, window._pendingDeleteId);
    openModal(confirmModal);
}

window.showConfirmDelete = showConfirmDelete;

// ========== 工具提示 ==========
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'error-toast toast-success';
    toast.textContent = '✅ ' + message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

// ========== 分类切换 ==========
async function switchCategory(categoryId) {
    if (categoryId === activeCategoryId) return;
    activeCategoryId = categoryId;
    searchTerm = '';
    selectedTaskIds.clear();
    searchInput.value = '';
    renderCategoryHeader();
    renderForm();
    await fetchData();
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
                <label for="projectName">Project Name</label>
                <input type="text" id="projectName" placeholder="e.g. Project Alpha" required>
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
        const projectName = form.querySelector('#projectName').value.trim();
        const cargoDescription = form.querySelector('#cargoDescription').value.trim();

        await addTask({ arrivalDate, billOfLading, shippingCompany, projectName, cargoDescription });
        form.reset();
        submitBtn.disabled = false;
    });

    return form;
}

// ========== 活跃任务列表渲染 ==========
function renderActiveList() {
    taskList.innerHTML = '';

    if (isLoading) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-state';
        loadingDiv.innerHTML = '<div class="spinner"></div><span>Loading tasks...</span>';
        taskList.appendChild(loadingDiv);
        return;
    }

    // 排序
    const sorted = getSortedTasks(tasks);
    // 过滤
    const filtered = filteredTasks(sorted);

    if (filtered.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = searchTerm ? '🔍 No matching tasks found' : '🎉 No tasks yet — add one to get started!';
        taskList.appendChild(emptyDiv);
    } else {
        filtered.forEach(task => {
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

    // 批量选择复选框
    const selCheckbox = document.createElement('div');
    selCheckbox.className = 'select-checkbox' + (selectedTaskIds.has(task.id) ? ' checked' : '');
    selCheckbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTaskSelection(task.id);
    });

    const checkbox = document.createElement('div');
    checkbox.className = 'task-checkbox' + (task.completed ? ' checked' : '');
    checkbox.addEventListener('click', () => toggleTask(task.id));

    const title = document.createElement('h3');
    title.className = 'task-title' + (task.completed ? ' completed' : '');
    title.textContent = task.name;

    const buttons = document.createElement('div');
    buttons.className = 'action-buttons';

    // 编辑按钮（未完成的任务才能编辑）
    if (!task.completed) {
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit-btn';
        editBtn.title = 'Edit task';
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', () => startEdit(task.id));
        buttons.appendChild(editBtn);
    }

    // 归档按钮（仅已完成的任务）
    if (task.completed) {
        const archiveBtn = document.createElement('button');
        archiveBtn.className = 'action-btn archive-btn';
        archiveBtn.title = 'Archive completed task';
        archiveBtn.textContent = '📦';
        archiveBtn.addEventListener('click', () => archiveTask(task.id));
        buttons.appendChild(archiveBtn);
    }

    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn confirm-delete-btn';
    deleteBtn.title = 'Delete task';
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => softDeleteTask(task.id));
    buttons.appendChild(deleteBtn);

    top.appendChild(selCheckbox);
    top.appendChild(checkbox);
    top.appendChild(title);
    top.appendChild(buttons);

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

    // 批量选择复选框
    const selCheckbox = document.createElement('div');
    selCheckbox.className = 'select-checkbox' + (selectedTaskIds.has(task.id) ? ' checked' : '');
    selCheckbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTaskSelection(task.id);
    });

    const checkbox = document.createElement('div');
    checkbox.className = 'task-checkbox' + (task.completed ? ' checked' : '');
    checkbox.addEventListener('click', () => toggleTask(task.id));

    const title = document.createElement('h3');
    title.className = 'task-title' + (task.completed ? ' completed' : '');
    title.textContent = task.billOfLading;

    const buttons = document.createElement('div');
    buttons.className = 'action-buttons';

    // 编辑按钮（未完成的任务才能编辑）
    if (!task.completed) {
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit-btn';
        editBtn.title = 'Edit task';
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', () => startEdit(task.id));
        buttons.appendChild(editBtn);
    }

    // 归档按钮（仅已完成的任务）
    if (task.completed) {
        const archiveBtn = document.createElement('button');
        archiveBtn.className = 'action-btn archive-btn';
        archiveBtn.title = 'Archive completed task';
        archiveBtn.textContent = '📦';
        archiveBtn.addEventListener('click', () => archiveTask(task.id));
        buttons.appendChild(archiveBtn);
    }

    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn confirm-delete-btn';
    deleteBtn.title = 'Delete task';
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => softDeleteTask(task.id));
    buttons.appendChild(deleteBtn);

    top.appendChild(selCheckbox);
    top.appendChild(checkbox);
    top.appendChild(title);
    top.appendChild(buttons);

    const meta = document.createElement('div');
    meta.className = 'task-meta clearance-meta';
    meta.innerHTML = `
        <span><strong>Arrival:</strong> ${formatDate(task.arrivalDate)}</span>
        <span><strong>Shipping:</strong> ${task.shippingCompany}</span>
        <span><strong>Project:</strong> ${task.projectName || '-'}</span>
    `;

    const desc = document.createElement('div');
    desc.className = 'task-description';
    desc.textContent = task.cargoDescription;

    li.appendChild(top);
    li.appendChild(meta);
    li.appendChild(desc);
    return li;
}

// ========== 已归档任务列表渲染 ==========
function renderArchivedList() {
    archivedList.innerHTML = '';
    const sortedArchived = getSortedTasks(archivedTasks);

    if (sortedArchived.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'section-empty';
        emptyDiv.textContent = 'No completed tasks archived yet';
        archivedList.appendChild(emptyDiv);
    } else {
        sortedArchived.forEach(task => {
            const li = document.createElement('li');
            li.className = 'archived-card';

            const top = document.createElement('div');
            top.className = 'task-card-top';

            const checkbox = document.createElement('div');
            checkbox.className = 'task-checkbox checked';

            const title = document.createElement('h3');
            title.className = 'task-title completed';
            const taskName = activeCategoryId === 'construction' ? task.name : task.billOfLading;
            title.textContent = taskName;

            const buttons = document.createElement('div');
            buttons.className = 'action-buttons';

            // 恢复按钮
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'action-btn restore-btn';
            restoreBtn.textContent = '↩️';
            restoreBtn.title = 'Restore to active';
            restoreBtn.addEventListener('click', () => restoreFromArchived(task.id));
            buttons.appendChild(restoreBtn);

            // 从归档移至删除
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'action-btn delete-from-archive-btn';
            deleteBtn.textContent = '🗑️';
            deleteBtn.title = 'Move to deleted tasks';
            deleteBtn.addEventListener('click', () => moveToDeletedFromArchived(task.id));
            buttons.appendChild(deleteBtn);

            top.appendChild(checkbox);
            top.appendChild(title);
            top.appendChild(buttons);

            const meta = document.createElement('div');
            meta.className = 'task-meta';
            meta.innerHTML = `<span><strong>Archived:</strong> ${formatDate(task.archived_at)}</span>`;

            if (activeCategoryId === 'construction') {
                const progressBar = document.createElement('div');
                progressBar.className = 'progress-bar';
                progressBar.innerHTML = `
                    <div class="progress-fill" style="width: ${task.completionPercentage || 0}%"></div>
                    <span class="progress-text">${task.completionPercentage || 0}%</span>
                `;
                li.appendChild(top);
                li.appendChild(meta);
                li.appendChild(progressBar);
            } else {
                const desc = document.createElement('div');
                desc.className = 'task-description';
                desc.textContent = task.cargoDescription;
                meta.innerHTML += `<span><strong>Project:</strong> ${task.projectName || '-'}</span>`;
                li.appendChild(top);
                li.appendChild(meta);
                li.appendChild(desc);
            }

            archivedList.appendChild(li);
        });
    }

    archivedCount.textContent = archivedTasks.length;
    archivedSection.style.display = archivedTasks.length > 0 ? 'block' : 'none';
}

// ========== 已删除任务列表渲染 ==========
function renderDeletedList() {
    deletedList.innerHTML = '';
    const sortedDeleted = getSortedTasks(deletedTasks);

    if (sortedDeleted.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'section-empty';
        emptyDiv.textContent = 'No deleted tasks';
        deletedList.appendChild(emptyDiv);
    } else {
        sortedDeleted.forEach(task => {
            const li = document.createElement('li');
            li.className = 'deleted-card';

            const top = document.createElement('div');
            top.className = 'task-card-top';

            const title = document.createElement('h3');
            title.className = 'task-title';
            const taskName = activeCategoryId === 'construction' ? task.name : task.billOfLading;
            title.textContent = taskName;

            const buttons = document.createElement('div');
            buttons.className = 'action-buttons';

            // 恢复按钮
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'action-btn undo-delete-btn';
            restoreBtn.textContent = '↩️';
            restoreBtn.title = 'Undo delete (restore)';
            restoreBtn.addEventListener('click', () => restoreFromDeleted(task.id));
            buttons.appendChild(restoreBtn);

            // 永久删除按钮
            const deleteForeverBtn = document.createElement('button');
            deleteForeverBtn.className = 'action-btn confirm-delete-btn';
            deleteForeverBtn.textContent = '⚠️';
            deleteForeverBtn.title = 'Permanently delete';
            deleteForeverBtn.addEventListener('click', () => {
                window._pendingDeleteId = task.id;
                showConfirmDelete('deleted', 'Deleted Tasks List');
            });
            buttons.appendChild(deleteForeverBtn);

            top.appendChild(title);
            top.appendChild(buttons);

            const meta = document.createElement('div');
            meta.className = 'task-meta';
            meta.innerHTML = `<span><strong>Deleted:</strong> ${formatDate(task.deleted_at)}</span>`;

            if (activeCategoryId === 'construction') {
                const progressBar = document.createElement('div');
                progressBar.className = 'progress-bar';
                progressBar.innerHTML = `
                    <div class="progress-fill" style="width: ${task.completionPercentage || 0}%"></div>
                    <span class="progress-text">${task.completionPercentage || 0}%</span>
                `;
                li.appendChild(top);
                li.appendChild(meta);
                li.appendChild(progressBar);
            } else {
                const desc = document.createElement('div');
                desc.className = 'task-description';
                desc.textContent = task.cargoDescription;
                meta.innerHTML += `<span><strong>Project:</strong> ${task.projectName || '-'}</span>`;
                li.appendChild(top);
                li.appendChild(meta);
                li.appendChild(desc);
            }

            deletedList.appendChild(li);
        });
    }

    deletedCount.textContent = deletedTasks.length;
    deletedSection.style.display = deletedTasks.length > 0 ? 'block' : 'none';
}

// ========== 全量重新渲染 ==========
function renderAll() {
    renderActiveList();
    renderArchivedList();
    renderDeletedList();
    updateBatchActionBar();
}

function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    statsText.textContent = `${completed} / ${total} tasks completed`;
}

// ========== 批量选择 ==========
function toggleTaskSelection(id) {
    if (selectedTaskIds.has(id)) {
        selectedTaskIds.delete(id);
    } else {
        selectedTaskIds.add(id);
    }
    updateBatchActionBar();
    renderActiveList();
}

function updateBatchActionBar() {
    const clearBtn = document.getElementById('clear-selection-btn');
    const selectionCount = toolBar.querySelector('.selection-count');
    const deleteBtn = document.getElementById('batch-delete-btn');
    const archiveBtn = document.getElementById('batch-archive-btn');
    
    const count = selectedTaskIds.size;
    
    if (count > 0) {
        // 显示批量操作相关元素
        if (clearBtn) clearBtn.style.display = 'inline-block';
        if (selectionCount) {
            selectionCount.style.display = 'inline';
            selectionCount.textContent = `${count} selected`;
        }
        if (deleteBtn) {
            deleteBtn.style.display = 'inline-block';
            deleteBtn.disabled = false;
        }
        if (archiveBtn) {
            archiveBtn.style.display = 'inline-block';
            archiveBtn.disabled = false;
        }
    } else {
        // 隐藏批量操作相关元素
        if (clearBtn) clearBtn.style.display = 'none';
        if (selectionCount) selectionCount.style.display = 'none';
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
            deleteBtn.disabled = true;
        }
        if (archiveBtn) {
            archiveBtn.style.display = 'none';
            archiveBtn.disabled = true;
        }
    }
}

// ========== 切换任务完成状态 ==========
async function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newCompleted = !task.completed;

    try {
        await MockAPI.updateTask(id, { completed: newCompleted });
        task.completed = newCompleted;
        renderAll();
        await renderSidebar();
    } catch (err) {
        console.error('Failed to toggle task:', err);
        showError('Failed to update task');
    }
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
    renderForm();

    // 绑定事件
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            selectedTaskIds.clear();
            renderActiveList();
            updateBatchActionBar();
        });
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const sorted = getSortedTasks(tasks);
            const filtered = filteredTasks(sorted);
            if (e.target.checked) {
                filtered.forEach(t => selectedTaskIds.add(t.id));
            } else {
                selectedTaskIds.clear();
            }
            renderActiveList();
            updateBatchActionBar();
        });
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }

    if (batchActionbar) {
        const deleteBtn = document.getElementById('batch-delete-btn');
        const archiveBtn = document.getElementById('batch-archive-btn');
        const clearBtn = document.getElementById('clear-selection-btn');

        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (selectedTaskIds.size === 0) return;
                await batchDelete([...selectedTaskIds]);
            });
        }
        if (archiveBtn) {
            archiveBtn.addEventListener('click', async () => {
                if (selectedTaskIds.size === 0) return;
                await batchArchive([...selectedTaskIds]);
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                selectedTaskIds.clear();
                renderActiveList();
                updateBatchActionBar();
            });
        }
    }

    await fetchData();
    await renderSidebar();
}

init();
