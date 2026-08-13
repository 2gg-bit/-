/**
 * 排班系统测试场景脚本（直接调用排班核心算法，无需启动服务）
 * 运行：node test/scenarios.js   （或在 server 目录 npm test）
 *
 * 覆盖题目要求的三个测试场景：
 *   场景1：正常排班（默认数据，工时充足）
 *   场景2：人员状态调整后重新排班（模拟员工离岗）
 *   场景3：人手不足场景（任务量翻倍，触发告警与建议）
 */
const { generateSchedule } = require('../src/scheduler');
const { DEFAULT_SAMPLES, DEFAULT_STAFF, DEFAULT_TASKS } = require('../src/defaultData');

const line = '='.repeat(70);
let passCount = 0;
let failCount = 0;

function check(name, cond) {
  if (cond) {
    passCount++;
    console.log(`  [通过] ${name}`);
  } else {
    failCount++;
    console.log(`  [失败] ${name}`);
  }
}

function printSummary(result) {
  const s = result.summary;
  console.log(`  完成样本: ${s.completedCount}/${s.totalTasks} (${s.completionRate}%)`);
  console.log(`  用工: ${s.totalUsedHours}h / 可用: ${s.totalAvailableHours}h`);
  console.log(`  收入 ¥${s.sampleRevenue} - 直接成本 ¥${s.sampleCost} - 人力成本 ¥${s.laborCost} = 利润 ¥${s.profit}`);
  console.log(`  积压: ${s.unfinishedCount} 个, 告警: ${result.warnings.length} 条`);
  result.warnings.forEach((w) => console.log(`    [${w.level}] ${w.message}`));
}

// ---------------- 场景1：正常排班 ----------------
console.log('\n' + line);
console.log('场景1：正常排班（默认数据）');
console.log(line);

const r1 = generateSchedule(DEFAULT_STAFF, DEFAULT_SAMPLES, DEFAULT_TASKS, '2026-08-13');
printSummary(r1);
console.log('断言：');
check('全部样本完成，无积压', r1.summary.unfinishedCount === 0);
check('完成率 = 100%', r1.summary.completionRate === 100);
check('无严重告警', !r1.warnings.some((w) => w.level === '严重'));
check('利润 = 收入 - 直接成本 - 人力成本', Math.abs(r1.summary.profit - (r1.summary.sampleRevenue - r1.summary.sampleCost - r1.summary.laborCost)) < 0.01);
check('每人实际工时不超过可用工时', r1.utilization.every((u) => u.usedHours <= u.availableHours + 1e-9));
check('所有分配均满足技能匹配', r1.assignments.every((a) => {
  const p = DEFAULT_STAFF.find((x) => x.id === a.staffId);
  return p && p.skills.includes(a.sampleId);
}));
console.log(`  人员利用率：${r1.utilization.map((u) => `${u.staffName} ${u.utilization}%`).join(' / ')}`);

// ---------------- 场景2：调整后重新排班 ----------------
console.log('\n' + line);
console.log('场景2：人员状态调整后重新排班（张伟、李娜离岗）');
console.log(line);

const staff2 = DEFAULT_STAFF.map((p) =>
  p.id === 1 || p.id === 2 ? { ...p, available: false } : p
);
const r2 = generateSchedule(staff2, DEFAULT_SAMPLES, DEFAULT_TASKS, '2026-08-13');
printSummary(r2);
console.log('断言：');
check('离岗人员未被分配任何任务', r2.assignments.every((a) => a.staffId !== 1 && a.staffId !== 2));
check('重新排班后结果与场景1不同（重排生效）', JSON.stringify(r2.assignments.map(a=>[a.staffId,a.sampleId])) !== JSON.stringify(r1.assignments.map(a=>[a.staffId,a.sampleId])));
check('出现告警（人力减少导致部分样本无法安排）', r2.warnings.length > 0);
check('告警包含调整建议', r2.warnings.every((w) => w.suggestion && w.suggestion.length > 0));
check('剩余人员工时仍不超限', r2.utilization.every((u) => u.usedHours <= u.availableHours + 1e-9));

// ---------------- 场景3：人手不足 ----------------
console.log('\n' + line);
console.log('场景3：人手不足（任务量大幅增加）');
console.log(line);

const heavyTasks = [
  { sampleId: 'A', count: 40 },
  { sampleId: 'B', count: 25 },
  { sampleId: 'C', count: 20 },
  { sampleId: 'D', count: 10 },
  { sampleId: 'E', count: 30 },
];
const r3 = generateSchedule(DEFAULT_STAFF, DEFAULT_SAMPLES, heavyTasks, '2026-08-13');
printSummary(r3);
console.log('断言：');
check('出现未完成样本（积压）', r3.summary.unfinishedCount > 0);
check('存在严重级别告警', r3.warnings.some((w) => w.level === '严重'));
check('预测缺口工时 > 0', r3.forecast.gapHours > 0);
check('预计完成率 < 100%', r3.forecast.estimatedCompletionRate < 100);
check('告警给出具体调整建议', r3.warnings.some((w) => w.suggestion && w.suggestion.length > 0));
// A 优先级1，E 优先级3：E 的积压占比应不低于 A（高优先级样本优先被安排）
{
  const aLeft = r3.unfinished.filter((u) => u.sampleId === 'A').length;
  const eLeft = r3.unfinished.filter((u) => u.sampleId === 'E').length;
  check('高优先级样本(A)优先被安排，积压占比不高于低优先级(E)', aLeft / 40 <= eLeft / 30 + 1e-9);
}

// ---------------- 汇总 ----------------
console.log('\n' + line);
console.log(`测试结果：通过 ${passCount} 项，失败 ${failCount} 项`);
console.log(line);
process.exit(failCount > 0 ? 1 : 0);
