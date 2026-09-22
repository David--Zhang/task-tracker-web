// Mock API - 模拟后端接口，用于 Demo 演示
// 模拟网络延迟：300-600ms

const MockAPI = {
    // 模拟数据库
    db: {
        categories: [
            { id: 'construction', name: 'Construction', icon: '🏗️', description: 'Construction project tasks' },
            { id: 'custom-clearance', name: 'Custom Clearance', icon: '📦', description: 'Custom clearance process tasks' }
        ],
        tasks: [
            // Construction 示例数据
            {
                id: 'demo-1', category_id: 'construction',
                name: 'Review architectural blueprints',
                startDate: '2026-01-05', completionDate: '2026-01-12',
                completionPercentage: 100, completed: true,
                created_at: new Date(Date.now() - 86400000).toISOString(),
                updated_at: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: 'demo-2', category_id: 'construction',
                name: 'Order building materials',
                startDate: '2026-01-08', completionDate: '2026-01-15',
                completionPercentage: 100, completed: true,
                created_at: new Date(Date.now() - 43200000).toISOString(),
                updated_at: new Date(Date.now() - 43200000).toISOString()
            },
            {
                id: 'demo-3', category_id: 'construction',
                name: 'Schedule site inspection',
                startDate: '2026-01-20', completionDate: '2026-02-01',
                completionPercentage: 35, completed: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: 'demo-4', category_id: 'construction',
                name: 'Install electrical wiring',
                startDate: '2026-02-05', completionDate: '2026-02-20',
                completionPercentage: 0, completed: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            // Custom Clearance 示例数据
            {
                id: 'demo-5', category_id: 'custom-clearance',
                arrivalDate: '2026-02-10', billOfLading: 'BOL-2026-001',
                shippingCompany: 'Maersk', cargoDescription: 'Steel beams and construction frames',
                projectName: 'Project Alpha', completed: true,
                created_at: new Date(Date.now() - 86400000).toISOString(),
                updated_at: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: 'demo-6', category_id: 'custom-clearance',
                arrivalDate: '2026-02-15', billOfLading: 'BOL-2026-002',
                shippingCompany: 'COSCO', cargoDescription: 'Electrical cables and switchboards',
                projectName: 'Project Beta', completed: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: 'demo-7', category_id: 'custom-clearance',
                arrivalDate: '2026-02-22', billOfLading: 'BOL-2026-003',
                shippingCompany: 'MSC', cargoDescription: 'HVAC equipment',
                projectName: 'Project Gamma', completed: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        ],
        // 已归档的任务（用户手动移入"已完成任务"区域）
        archivedTasks: [],
        // 已删除的任务（软删除）
        deletedTasks: []
    },

    // 模拟网络延迟
    delay() {
        return new Promise(resolve => {
            const ms = 300 + Math.random() * 300;
            setTimeout(resolve, ms);
        });
    },

    // 生成 ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    // ========== GET /api/categories ==========
    async getCategories() {
        await this.delay();
        const result = this.db.categories.map(cat => {
            const catTasks = this.db.tasks.filter(t => t.category_id === cat.id);
            return {
                ...cat,
                total: catTasks.length,
                completed: catTasks.filter(t => t.completed).length
            };
        });
        return { data: result };
    },

    // ========== GET /api/tasks?category_id=xxx ==========
    async getTasks(categoryId) {
        await this.delay();
        const tasks = this.db.tasks.filter(t => t.category_id === categoryId);
        return { data: tasks };
    },

    // ========== GET /api/archived?category_id=xxx ==========
    async getArchived(categoryId) {
        await this.delay();
        const archived = this.db.archivedTasks.filter(t => t.category_id === categoryId);
        return { data: archived };
    },

    // ========== GET /api/deleted?category_id=xxx ==========
    async getDeleted(categoryId) {
        await this.delay();
        const deleted = this.db.deletedTasks.filter(t => t.category_id === categoryId);
        return { data: deleted };
    },

    // ========== POST /api/tasks ==========
    async createTask(categoryId, taskData) {
        await this.delay();
        const now = new Date().toISOString();
        const task = {
            id: this.generateId(), category_id: categoryId,
            completed: false,
            created_at: now, updated_at: now,
            ...taskData
        };
        this.db.tasks.push(task);
        return { data: task };
    },

    // ========== PATCH /api/tasks/:id ==========
    async updateTask(id, updates) {
        await this.delay();
        const task = this.db.tasks.find(t => t.id === id);
        if (!task) throw new Error('Task not found');
        Object.assign(task, updates, { updated_at: new Date().toISOString() });
        return { data: task };
    },

    // ========== PATCH /api/archived/:id ==========
    async updateArchived(id, updates) {
        await this.delay();
        const task = this.db.archivedTasks.find(t => t.id === id);
        if (!task) throw new Error('Archived task not found');
        Object.assign(task, updates, { updated_at: new Date().toISOString() });
        return { data: task };
    },

    // ========== 归档已完成任务 ==========
    async archiveTask(id) {
        await this.delay();
        const index = this.db.tasks.findIndex(t => t.id === id);
        if (index === -1) throw new Error('Task not found');
        const task = this.db.tasks.splice(index, 1)[0];
        task.archived_at = new Date().toISOString();
        this.db.archivedTasks.push(task);
        return { data: task };
    },

    // ========== 从已归档恢复任务 ==========
    async unarchiveTask(id) {
        await this.delay();
        const index = this.db.archivedTasks.findIndex(t => t.id === id);
        if (index === -1) throw new Error('Archived task not found');
        const task = this.db.archivedTasks.splice(index, 1)[0];
        delete task.archived_at;
        this.db.tasks.push(task);
        return { data: task };
    },

    // ========== 软删除任务 ==========
    async deleteTask(id) {
        await this.delay();
        const index = this.db.tasks.findIndex(t => t.id === id);
        if (index === -1) throw new Error('Task not found');
        const task = this.db.tasks.splice(index, 1)[0];
        task.deleted_at = new Date().toISOString();
        this.db.deletedTasks.push(task);
        return { data: task };
    },

    // ========== 恢复已删除任务 ==========
    async undeleteTask(id) {
        await this.delay();
        const index = this.db.deletedTasks.findIndex(t => t.id === id);
        if (index === -1) throw new Error('Deleted task not found');
        const task = this.db.deletedTasks.splice(index, 1)[0];
        delete task.deleted_at;
        this.db.tasks.push(task);
        return { data: task };
    },

    // ========== 从已归档列表中删除 ==========
    async deleteFromArchived(id) {
        await this.delay();
        const index = this.db.archivedTasks.findIndex(t => t.id === id);
        if (index === -1) throw new Error('Archived task not found');
        const task = this.db.archivedTasks.splice(index, 1)[0];
        this.db.deletedTasks.push({ ...task, deleted_at: new Date().toISOString() });
        return { data: { success: true } };
    },

    // ========== 永久删除 ==========
    async permanentDelete(type, id) {
        await this.delay();
        let targetArray;
        if (type === 'deleted') {
            targetArray = this.db.deletedTasks;
        } else if (type === 'archived') {
            targetArray = this.db.archivedTasks;
        } else {
            throw new Error('Invalid type');
        }
        const index = targetArray.findIndex(t => t.id === id);
        if (index === -1) throw new Error(`${type} task not found`);
        targetArray.splice(index, 1);
        return { data: { success: true } };
    }
};

// Allow require() in Node.js for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MockAPI;
}
