#!/usr/bin/env node
// scripts/migrate.js — 旧 localStorage 数据迁移脚本
//
// 用途：把 MVP 阶段（纯 localStorage）保存的旧任务数据导入到 SQLite 数据库。
//
// 旧数据形状（每分类一个 key）：
//   localStorage['task-tracker-tasks-construction']     -> [{ id, text, completed }]
//   localStorage['task-tracker-tasks-custom-clearance'] -> [{ id, text, completed }]
//
// 用法：
//   1. 在浏览器控制台执行下面的导出命令，把结果保存为 dump.json：
//
//      copy(JSON.stringify({
//          construction: JSON.parse(localStorage.getItem('task-tracker-tasks-construction') || '[]'),
//          'custom-clearance': JSON.parse(localStorage.getItem('task-tracker-tasks-custom-clearance') || '[]')
//      }, null, 2));
//
//   2. 迁移（会先列出将要导入的数据，确认后写入）：
//      node scripts/migrate.js dump.json
//      node scripts/migrate.js dump.json --dry-run    # 只预览，不写库
//
// 字段映射规则：
//   - Construction:  text -> name；startDate/completionDate 置空（界面显示 '-'）；
//                    completionPercentage = completed ? 100 : 0
//   - Custom Clearance: text -> billOfLading 与 cargoDescription；
//                    arrivalDate 置空；shippingCompany/projectName 置空；projectName = '(migrated)'
//   - 旧数据全部视为 active 状态；保留原 id（若存在且未冲突），否则服务端生成新 id。

const fs = require('node:fs');
const path = require('node:path');
const { initDb } = require('../server/db');

const DEFAULT_DB = path.join(__dirname, '..', 'data', 'tasks.db');
const VALID_CATEGORIES = ['construction', 'custom-clearance'];

function printUsage() {
    console.log('Usage: node scripts/migrate.js <dump.json> [--dry-run] [--db <path>]');
}

// 把旧形状 {id, text, completed} 映射为新分类字段
function transformTask(categoryId, oldTask) {
    const text = (oldTask.text || '').trim();
    const completed = !!oldTask.completed;
    const base = {
        category_id: categoryId,
        completed,
        status: 'active'
    };
    if (oldTask.id) base.id = String(oldTask.id);

    if (categoryId === 'construction') {
        return {
            ...base,
            name: text,
            startDate: null,
            completionDate: null,
            completionPercentage: completed ? 100 : 0
        };
    }
    // custom-clearance
    return {
        ...base,
        arrivalDate: null,
        billOfLading: text,
        shippingCompany: '',
        projectName: '(migrated)',
        cargoDescription: text
    };
}

// 支持两种 dump 格式：
//   1) { construction: [...], 'custom-clearance': [...] }
//   2) 扁平数组 [{ category_id, text, completed }, ...]
function normalizeDump(dump) {
    const result = [];
    if (Array.isArray(dump)) {
        for (const t of dump) {
            if (VALID_CATEGORIES.includes(t.category_id)) {
                result.push(transformTask(t.category_id, t));
            }
        }
        return result;
    }
    if (dump && typeof dump === 'object') {
        for (const cat of VALID_CATEGORIES) {
            const list = Array.isArray(dump[cat]) ? dump[cat] : [];
            for (const t of list) {
                result.push(transformTask(cat, t));
            }
        }
    }
    return result;
}

function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const dbIndex = args.indexOf('--db');
    const dbPath = dbIndex !== -1 ? args[dbIndex + 1] : DEFAULT_DB;
    const fileArg = args.find(a => !a.startsWith('--') && a !== dbPath);

    if (!fileArg) {
        printUsage();
        process.exit(1);
    }
    if (!fs.existsSync(fileArg)) {
        console.error(`❌ 找不到文件: ${fileArg}`);
        process.exit(1);
    }

    let dump;
    try {
        dump = JSON.parse(fs.readFileSync(fileArg, 'utf8'));
    } catch (err) {
        console.error(`❌ JSON 解析失败: ${err.message}`);
        process.exit(1);
    }

    const tasks = normalizeDump(dump);
    if (tasks.length === 0) {
        console.log('⚠️  未找到可迁移的任务（dump 为空或格式不匹配）。');
        process.exit(0);
    }

    console.log(`\n📦 共解析出 ${tasks.length} 条旧任务`);
    console.log(dryRun ? '   （dry-run 模式：只预览，不写入数据库）\n' : '\n');

    if (dryRun) {
        tasks.forEach((t, i) => {
            const label = t.category_id === 'construction' ? t.name : t.billOfLading;
            console.log(`  ${i + 1}. [${t.category_id}] ${label}  (completed=${t.completed})`);
        });
        console.log('\n✅ dry-run 完成，未写入任何数据。');
        process.exit(0);
    }

    const db = initDb(dbPath);
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const failures = [];

    for (const t of tasks) {
        try {
            const r = db.importTask(t);
            if (r.imported) imported++;
            else skipped++;
        } catch (err) {
            failed++;
            failures.push({ id: t.id, message: err.message });
        }
    }

    db.close();

    console.log('========================================');
    console.log(`✅ 导入成功: ${imported}`);
    console.log(`⏭️  跳过(已存在): ${skipped}`);
    console.log(`❌ 失败: ${failed}`);
    if (failures.length > 0) {
        failures.forEach(f => console.log(`   - id=${f.id}: ${f.message}`));
    }
    console.log(`\n数据库: ${dbPath}`);
    console.log('========================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

main();