/**
 * 轻量 JSON 持久化存储（本地文件，无外部数据库依赖）
 * 文件结构：server/data/db.json
 * {
 *   samples: [...],      // 样本类型配置
 *   staff: [...],        // 人员配置
 *   tasks: [...],        // 当日任务量
 *   currentSchedule: {...}, // 最新排班结果
 *   history: [...]       // 已保存的历史排班（供累计任务统计）
 * }
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) return null;
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}

function save(db) {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

module.exports = { load, save, DB_FILE };
