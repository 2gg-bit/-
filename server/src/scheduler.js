/**
 * 排班核心算法模块
 * ------------------------------------------------------------------
 * 算法设计说明（贪心 + 多轮分配）：
 *
 * 依据题目要求的排班优先级设计：
 *   P1 硬约束：技能匹配 + 在岗状态 + 可用工时（不满足则不参与分配）
 *   P2 样本排序：高优先级、高单位毛利的样本先排（保证重要任务优先）
 *   P3 减少积压：尽量把任务分配出去，能排尽排
 *   P4 人员选择：同一岗位候选多时，优先选"高效 + 低成本 + 负载轻"的人
 *   P5 兜底说明：无法完成的目标样本记入积压清单并生成告警与建议
 *
 * 核心流程：
 *   1. 过滤在岗人员，初始化每人"剩余工时" = 可用工时
 *   2. 将当日任务展开为逐个样本，按（优先级升序、单位毛利降序）排序
 *   3. 对每个样本，在"技能匹配且剩余工时足够"的候选中，
 *      用加权评分函数选出最优人员并分配（消耗其剩余工时）
 *   4. 无法分配的样本进入积压列表
 *   5. 汇总统计 + 生成告警与调整建议
 *
 * 加权评分函数（人员选择）：
 *   score = 0.45 * 效率系数 + 0.25 * (1 - 时薪/最高时薪) + 0.30 * (1 - 已用工时/可用工时)
 *   含义：效率越高、成本越低、当前负载越轻的人员得分越高（兼顾效益与负载均衡）。
 *
 * 利润计算公式（题目第11条）：
 *   利润 = 样本收入 - 样本直接成本 - 人力成本
 *   样本收入 = 完成样本数 × 单位业务价值
 *   样本直接成本 = 完成样本数 × 单位直接成本
 *   人力成本 = 实际排班工时 × 时薪
 * ------------------------------------------------------------------
 */

/**
 * 生成排班计划
 * @param {Array} staff    人员列表 [{id,name,type,skills:[],available,workHours,hourlyRate,efficiency}]
 * @param {Array} samples  样本类型配置 [{id,name,processMinutes,unitValue,unitCost,priority}]
 * @param {Array} tasks    当日任务量 [{sampleId,count}]
 * @param {String} date    排班日期（仅用于标记）
 * @returns {Object} 完整排班结果
 */
function generateSchedule(staff, samples, tasks, date) {
  // ---------- 1. 准备数据 ----------
  const sampleMap = new Map(samples.map((s) => [s.id, s]));

  // 过滤在岗人员，初始化剩余工时
  const workers = staff
    .filter((p) => p.available)
    .map((p) => ({
      ...p,
      remainingHours: p.workHours,
      usedHours: 0,
      assignmentCount: 0,
      assignmentDetails: [], // {sampleId, sampleName, hours, seq}
    }));

  const totalAvailableHours = workers.reduce((s, w) => s + w.workHours, 0);

  // 将任务展开为逐个样本
  const sampleQueue = [];
  for (const t of tasks) {
    const conf = sampleMap.get(t.sampleId);
    if (!conf || !(t.count > 0)) continue;
    for (let i = 0; i < t.count; i++) {
      sampleQueue.push({ sampleId: conf.id, sampleName: conf.name, conf, seq: i + 1 });
    }
  }

  // 排序：优先级数值小者先排；同优先级按单位毛利（价值-成本）降序
  sampleQueue.sort((a, b) => {
    if (a.conf.priority !== b.conf.priority) return a.conf.priority - b.conf.priority;
    const profitA = a.conf.unitValue - a.conf.unitCost;
    const profitB = b.conf.unitValue - b.conf.unitCost;
    return profitB - profitA;
  });

  // ---------- 2. 贪心分配 ----------
  const maxRate = Math.max(...workers.map((w) => w.hourlyRate), 1);
  const unfinished = [];
  const assignments = [];
  let assignSeq = 0;

  for (const item of sampleQueue) {
    // 每个样本实际处理工时 = 标准工时 / 人员效率系数
    const candidates = workers
      .filter((w) => w.skills.includes(item.sampleId) && w.remainingHours > 0)
      .map((w) => {
        const needHours = (item.conf.processMinutes / 60) / w.efficiency;
        return { w, needHours };
      })
      .filter((c) => c.w.remainingHours >= c.needHours - 1e-9); // 剩余工时必须足够

    if (candidates.length === 0) {
      unfinished.push({ sampleId: item.sampleId, sampleName: item.sampleName, seq: item.seq });
      continue;
    }

    // 加权评分选人：效率高、成本低、负载轻
    candidates.sort((a, b) => {
      const score = (c) =>
        0.45 * c.w.efficiency +
        0.25 * (1 - c.w.hourlyRate / maxRate) +
        0.3 * (1 - c.w.usedHours / c.w.workHours);
      return score(b) - score(a);
    });

    const best = candidates[0];
    best.w.remainingHours -= best.needHours;
    best.w.usedHours += best.needHours;
    best.w.assignmentCount += 1;
    best.w.assignmentDetails.push({
      sampleId: item.sampleId,
      sampleName: item.sampleName,
      hours: best.needHours,
      seq: item.seq,
    });
    assignments.push({
      seq: ++assignSeq,
      staffId: best.w.id,
      staffName: best.w.name,
      sampleId: item.sampleId,
      sampleName: item.sampleName,
      sampleSeq: item.seq,
      hours: best.needHours,
    });
  }

  // ---------- 3. 统计汇总 ----------
  const taskMap = new Map(tasks.map((t) => [t.sampleId, t.count]));
  const completedBySample = new Map(); // sampleId -> 完成数
  for (const a of assignments) {
    completedBySample.set(a.sampleId, (completedBySample.get(a.sampleId) || 0) + 1);
  }

  let sampleRevenue = 0;
  let sampleCost = 0;
  for (const [sid, count] of completedBySample) {
    const conf = sampleMap.get(sid);
    sampleRevenue += conf.unitValue * count;
    sampleCost += conf.unitCost * count;
  }

  const laborCost = assignments.reduce(
    (s, a) => s + a.hours * (workers.find((w) => w.id === a.staffId).hourlyRate),
    0
  );
  const profit = sampleRevenue - sampleCost - laborCost;

  // 利用率 = 已用 / 可用
  const utilization = workers.map((w) => ({
    staffId: w.id,
    staffName: w.name,
    type: w.type,
    usedHours: round2(w.usedHours),
    availableHours: w.workHours,
    utilization: w.workHours > 0 ? round2((w.usedHours / w.workHours) * 100) : 0,
    assignmentCount: w.assignmentCount,
    assignmentDetails: w.assignmentDetails,
  }));

  const totalUsedHours = workers.reduce((s, w) => s + w.usedHours, 0);

  // ---------- 4. 工作量预测与告警 ----------
  const warnings = [];
  const totalDemandHours = sampleQueue.reduce((s, i) => s + i.conf.processMinutes / 60, 0);
  const forecast = {
    totalTaskCount: sampleQueue.length,
    demandHours: round2(totalDemandHours),
    availableHours: round2(totalAvailableHours),
    gapHours: round2(Math.max(0, totalDemandHours - totalAvailableHours)),
    estimatedCompletionRate:
      totalDemandHours > 0
        ? Math.min(100, round2((totalAvailableHours / totalDemandHours) * 100))
        : 100,
  };

  if (unfinished.length > 0) {
    const group = {};
    for (const u of unfinished) {
      group[u.sampleId] = (group[u.sampleId] || 0) + 1;
    }
    const detail = Object.entries(group)
      .map(([sid, n]) => `${sampleMap.get(sid).name}(${sid}) ${n} 个`)
      .join('、');
    warnings.push({
      level: '严重',
      message: `人力不足：${unfinished.length} 个样本未能安排，明细：${detail}。`,
      suggestion: '建议：增派具备相应技能的人员、适当延长可用工时，或与客户协商调整样本优先级/交期。',
    });
  }

  workers.forEach((w) => {
    if (w.workHours > 0 && w.usedHours / w.workHours >= 0.95) {
      warnings.push({
        level: '提示',
        message: `${w.name} 的工时利用率已达 ${round2((w.usedHours / w.workHours) * 100)}%，接近上限。`,
        suggestion: '建议：关注该员工负载，必要时安排人员支援。',
      });
    }
  });

  if (totalUsedHours > totalAvailableHours - 1e-9 && unfinished.length === 0) {
    warnings.push({
      level: '提示',
      message: '全部样本已排满，且总可用工时基本耗尽。',
      suggestion: '建议：若临时新增任务，请先评估是否需要增加人手。',
    });
  }

  // ---------- 5. 返回结果 ----------
  return {
    date: date || new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    assignments,
    unfinished,
    utilization,
    summary: {
      totalTasks: sampleQueue.length,
      completedCount: assignments.length,
      unfinishedCount: unfinished.length,
      completionRate:
        sampleQueue.length > 0 ? round2((assignments.length / sampleQueue.length) * 100) : 100,
      totalUsedHours: round2(totalUsedHours),
      totalAvailableHours: round2(totalAvailableHours),
      sampleRevenue: round2(sampleRevenue),
      sampleCost: round2(sampleCost),
      laborCost: round2(laborCost),
      profit: round2(profit),
    },
    completedBySample: Object.fromEntries(completedBySample),
    taskMap: Object.fromEntries(taskMap),
    forecast,
    warnings,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { generateSchedule };
