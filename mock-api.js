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
            { id: 'demo-1', category_id: 'construction', text: 'Review architectural blueprints', completed: true, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString() },
            { id: 'demo-2', category_id: 'construction', text: 'Order building materials', completed: true, created_at: new Date(Date.now() - 43200000).toISOString(), updated_at: new Date(Date.now() - 43200000).toISOString() },
            { id: 'demo-3', category_id: 'construction', text: 'Schedule site inspection', completed: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: 'demo-4', category_id: 'construction', text: 'Install electrical wiring', completed: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            // Custom Clearance 示例数据
            { id: 'demo-5', category_id: 'custom-clearance', text: 'Prepare customs declaration forms', completed: true, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString() },
            { id: 'demo-6', category_id: 'custom-clearance', text: 'Submit shipping documents', completed: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { id: 'demo-7', category_id: 'custom-clearance', text: 'Pay import duties', completed: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ]
    },

    // 模拟网络延迟
    delay() {
        return new Promise(resolve => {
            const ms = 300 + Math.random() * 300; // 300-600ms
            setTimeout(resolve, ms);
        });
    },

    // 生成 ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    // GET /api/categories
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

    // GET /api/tasks?category_id=xxx
    async getTasks(categoryId) {
        await this.delay();
        const tasks = this.db.tasks.filter(t => t.category_id === categoryId);
        return { data: tasks };
    },

    // POST /api/tasks
    async createTask(categoryId, text) {
        await this.delay();
        const now = new Date().toISOString();
        const task = {
            id: this.generateId(),
            category_id: categoryId,
            text: text,
            completed: false,
            created_at: now,
            updated_at: now
        };
        this.db.tasks.push(task);
        return { data: task };
    },

    // PATCH /api/tasks/:id
    async updateTask(id, updates) {
        await this.delay();
        const task = this.db.tasks.find(t => t.id === id);
        if (!task) {
            throw new Error('Task not found');
        }
        Object.assign(task, updates, { updated_at: new Date().toISOString() });
        return { data: task };
    },

    // DELETE /api/tasks/:id
    async deleteTask(id) {
        await this.delay();
        const index = this.db.tasks.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error('Task not found');
        }
        this.db.tasks.splice(index, 1);
        return { data: { success: true } };
    }
};
