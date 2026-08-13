/**
 * 检测实验室排班管理系统 - 后端服务
 * 技术栈：Node.js + Express + 本地 JSON 持久化
 *
 * 启动方式：
 *   开发模式：node src/index.js（仅 API，默认端口 3001）
 *   生产模式：npm start（API + 托管前端构建产物 client/dist，单进程运行）
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const { generateSchedule } = require('./scheduler');
const { DEFAULT_SAMPLES, DEFAULT_STAFF, DEFAULT_TASKS } = require('./defaultData');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// ---------- 数据初始化（首次启动写入默认数据） ----------
function initDb() {
  const existing = store.load();
  if (existing) return existing;
  const db = {
    samples: DEFAULT_SAMPLES,
    staff: DEFAULT_STAFF,
    tasks: DEFAULT_TASKS,
    currentSchedule: null,
    history: [],
  };
  store.save(db);
  return db;
}

let db = initDb();

// ---------- API ----------

// 获取全量状态（看板/配置页共用）
app.get('/api/state', (req, res) => {
  const historySummary = db.history
    .slice(-14)
    .map((h) => ({
      date: h.date,
      completedCount: h.summary.completedCount,
      profit: h.summary.profit,
      totalUsedHours: h.summary.totalUsedHours,
      completionRate: h.summary.completionRate,
    }))
    .reverse();
  const totalCompletedAccumulated = db.history.reduce((s, h) => s + h.summary.completedCount, 0);
  res.json({
    samples: db.samples,
    staff: db.staff,
    tasks: db.tasks,
    currentSchedule: db.currentSchedule,
    historySummary,
    totalCompletedAccumulated,
  });
});

// 更新样本类型配置（加分项：参数配置）
app.put('/api/samples', (req, res) => {
  const { samples } = req.body;
  if (!Array.isArray(samples) || samples.length === 0) {
    return res.status(400).json({ error: '样本配置不能为空' });
  }
  for (const s of samples) {
    if (!s.id || !s.name || s.processMinutes <= 0 || s.unitValue < 0 || s.unitCost < 0 || !s.priority) {
      return res.status(400).json({ error: `样本 ${s.id} 配置不完整或参数非法` });
    }
  }
  db.samples = samples;
  // 清理任务中已不存在的样本类型
  const ids = new Set(samples.map((s) => s.id));
  db.tasks = db.tasks.filter((t) => ids.has(t.sampleId));
  store.save(db);
  res.json({ ok: true, samples: db.samples, tasks: db.tasks });
});

// 更新人员配置（含在岗状态切换 —— 需求6：手动调整后重新排班）
app.put('/api/staff', (req, res) => {
  const { staff } = req.body;
  if (!Array.isArray(staff) || staff.length === 0) {
    return res.status(400).json({ error: '人员配置不能为空' });
  }
  for (const p of staff) {
    if (!p.name || !p.type || p.workHours <= 0 || p.hourlyRate < 0 || p.efficiency <= 0) {
      return res.status(400).json({ error: `人员 ${p.name} 配置不完整或参数非法` });
    }
  }
  db.staff = staff;
  store.save(db);
  res.json({ ok: true, staff: db.staff });
});

// 更新当日任务量
app.put('/api/tasks', (req, res) => {
  const { tasks } = req.body;
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: '任务数据格式错误' });
  }
  const ids = new Set(db.samples.map((s) => s.id));
  for (const t of tasks) {
    if (!ids.has(t.sampleId)) {
      return res.status(400).json({ error: `样本类型 ${t.sampleId} 不存在` });
    }
    if (!Number.isInteger(t.count) || t.count < 0) {
      return res.status(400).json({ error: `样本 ${t.sampleId} 数量非法` });
    }
  }
  db.tasks = tasks.filter((t) => t.count > 0);
  store.save(db);
  res.json({ ok: true, tasks: db.tasks });
});

// 工作量预测（不落库，仅返回预测结果）
app.post('/api/predict', (req, res) => {
  const tasks = req.body.tasks || db.tasks;
  const forecast = predictWorkload(db.samples, db.staff, tasks);
  res.json(forecast);
});

// 生成排班（核心接口）
app.post('/api/schedule', (req, res) => {
  const tasks = req.body.tasks || db.tasks;
  const result = generateSchedule(db.staff, db.samples, tasks);
  db.currentSchedule = result;
  store.save(db);
  res.json(result);
});

// 保存当前排班到历史（用于累计任务统计与趋势图）
app.post('/api/schedule/save', (req, res) => {
  if (!db.currentSchedule) {
    return res.status(400).json({ error: '暂无排班结果可保存' });
  }
  // 同一天重复保存则覆盖
  db.history = db.history.filter((h) => h.date !== db.currentSchedule.date);
  db.history.push(db.currentSchedule);
  db.history = db.history.slice(-365);
  store.save(db);
  res.json({ ok: true, historyCount: db.history.length });
});

// 清空历史记录
app.delete('/api/history', (req, res) => {
  db.history = [];
  store.save(db);
  res.json({ ok: true });
});

// 恢复默认数据（加分项1）
app.post('/api/reset', (req, res) => {
  db = {
    samples: DEFAULT_SAMPLES,
    staff: DEFAULT_STAFF,
    tasks: DEFAULT_TASKS,
    currentSchedule: null,
    history: db.history, // 保留历史，便于累计统计
  };
  store.save(db);
  res.json({ ok: true });
});

// ---------- 生产模式：托管前端构建产物 ----------
const distDir = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback：非 /api 路由交给前端
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log('[info] 检测到前端构建产物，已启用静态托管');
} else {
  console.log('[info] 未检测到前端构建产物（client/dist），仅提供 API 服务');
}

// ---------- 错误处理 ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误：' + err.message });
});

app.listen(PORT, () => {
  console.log(`检测实验室排班管理系统后端已启动：http://localhost:${PORT}`);
});

// ---------- 工具函数：工作量预测 ----------
function predictWorkload(samples, staff, tasks) {
  const sampleMap = new Map(samples.map((s) => [s.id, s]));
  let totalCount = 0;
  let demandHours = 0;
  for (const t of tasks) {
    const conf = sampleMap.get(t.sampleId);
    if (!conf) continue;
    totalCount += t.count;
    demandHours += (conf.processMinutes / 60) * t.count;
  }
  const availableWorkers = staff.filter((p) => p.available);
  const availableHours = availableWorkers.reduce((s, p) => s + p.workHours, 0);
  const gapHours = Math.max(0, demandHours - availableHours);
  return {
    totalTaskCount: totalCount,
    demandHours: Math.round(demandHours * 100) / 100,
    availableHours: Math.round(availableHours * 100) / 100,
    gapHours: Math.round(gapHours * 100) / 100,
    estimatedCompletionRate:
      demandHours > 0 ? Math.min(100, Math.round((availableHours / demandHours) * 100)) : 100,
    availableWorkerCount: availableWorkers.length,
  };
}
