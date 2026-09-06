// Mock API - 模拟后端接口，用于 Demo 演示
// 模拟网络延迟：300-600ms

const MockAPI = {
    // 模拟数据库
    db: {
        projects: [
            { id: 'proj-1', name: 'Project Alpha' },
            { id: 'proj-2', name: 'Project Beta' }
        ],
        categories: [
            { id: 'construction', name: 'Construction', icon: '🏗️', description: 'Construction project tasks' },
            { id: 'custom-clearance', name: 'Custom Clearance', icon: '📦', description: 'Custom clearance process tasks' }
        ],
        tasks: [
            // Construction 示例数据
            {
                id: 'demo-1',
                category_id: 'construction',
                name: 'Review architectural blueprints',
                startDate: '2026-01-05',
                completionDate: '2026-01-12',
                completionPercentage: 100,
                completed: true,
                created_at: new Date(Date.now() - 86400000).toISOString(),
                updated_at: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: 'demo-2',
                category_id: 'construction',
                name: 'Order building materials',
                startDate: '2026-01-08',
                completionDate: '2026-01-15',
                completionPercentage: 100,
                completed: true,
                created_at: new Date(Date.now() - 43200000).toISOString(),
                updated_at: new Date(Date.now() - 43200000).toISOString()
            },
            {
                id: 'demo-3',
                category_id: 'construction',
                name: 'Schedule site inspection',
                startDate: '2026-01-20',
                completionDate: '2026-02-01',
                completionPercentage: 35,
                completed: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: 'demo-4',
                category_id: 'construction',
                name: 'Install electrical wiring',
                startDate: '2026-02-05',
                completionDate: '2026-02-20',
                completionPercentage: 0,
                completed: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            // Custom Clearance 示例数据
            {
                id: 'demo-5',
                category_id: 'custom-clearance',
                arrivalDate: '2026-02-10',
                billOfLading: 'BOL-2026-001',
                shippingCompany: 'Maersk',
                cargoDescription: 'Steel beams and construction frames',
                projectId: 'proj-1',
                completed: true,
                created_at: new Date(Date.now() - 86400000).toISOString(),
                updated_at: new Date(Date.now() - 86400000).toISOString()
            },
            {
                id: 'demo-6',
                category_id: 'custom-clearance',
                arrivalDate: '2026-02-15',
                billOfLading: 'BOL-2026-002',
                shippingCompany: 'COSCO',
                cargoDescription: 'Electrical cables and switchboards',
                projectId: 'proj-2',
                completed: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: 'demo-7',
                category_id: 'custom-clearance',
                arrivalDate: '2026-02-22',
                billOfLading: 'BOL-2026-003',
                shippingCompany: 'MSC',
                cargoDescription: 'HVAC equipment',
                projectId: 'proj-1',
                completed: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
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
    async createTask(categoryId, taskData) {
        await this.delay();
        const now = new Date().toISOString();
        const task = {
            id: this.generateId(),
            category_id: categoryId,
            completed: false,
            created_at: now,
            updated_at: now,
            ...taskData
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
    },

    // Project management for Custom Clearance
    async getProjects() {
        await this.delay();
        return { data: this.db.projects };
    },

    async createProject(name) {
        await this.delay();
        const project = { id: this.generateId(), name };
        this.db.projects.push(project);
        return { data: project };
    },

    async deleteProject(id) {
        await this.delay();
        const index = this.db.projects.findIndex(p => p.id === id);
        if (index === -1) {
            throw new Error('Project not found');
        }
        const removed = this.db.projects.splice(index, 1)[0];
        // Optionally remove references from tasks or leave them
        return { data: removed };
    }
};
