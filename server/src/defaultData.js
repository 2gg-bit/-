/**
 * 默认测试数据（可整体恢复，对应加分项：默认数据恢复）
 *
 * 设计说明：
 * - 5 类样本 A~E，覆盖不同处理时长、价值、成本与优先级
 * - 人员 6 名：4 名全职（8 小时）+ 2 名实习生（4 小时），总可用工时 40 小时
 * - 技能矩阵设计为"相邻覆盖 + 交叉备份"，保证正常负载下可排满，极端负载下可触发告警
 */
const DEFAULT_SAMPLES = [
  { id: 'A', name: '水质检测', processMinutes: 30, unitValue: 200, unitCost: 80, priority: 1 },
  { id: 'B', name: '土壤重金属检测', processMinutes: 45, unitValue: 350, unitCost: 150, priority: 1 },
  { id: 'C', name: '空气颗粒物检测', processMinutes: 60, unitValue: 500, unitCost: 200, priority: 2 },
  { id: 'D', name: '食品微生物检测', processMinutes: 120, unitValue: 800, unitCost: 300, priority: 2 },
  { id: 'E', name: '纺织品甲醛检测', processMinutes: 20, unitValue: 120, unitCost: 50, priority: 3 },
];

const DEFAULT_STAFF = [
  { id: 1, name: '张伟', type: '全职', skills: ['A', 'B', 'C'], available: true, workHours: 8, hourlyRate: 50, efficiency: 1.0 },
  { id: 2, name: '李娜', type: '全职', skills: ['B', 'C', 'D'], available: true, workHours: 8, hourlyRate: 55, efficiency: 1.1 },
  { id: 3, name: '王强', type: '全职', skills: ['C', 'D', 'E'], available: true, workHours: 8, hourlyRate: 48, efficiency: 0.95 },
  { id: 4, name: '赵敏', type: '全职', skills: ['A', 'B', 'E'], available: true, workHours: 8, hourlyRate: 52, efficiency: 1.05 },
  { id: 5, name: '陈晨', type: '实习生', skills: ['A', 'E'], available: true, workHours: 4, hourlyRate: 20, efficiency: 0.6 },
  { id: 6, name: '刘洋', type: '实习生', skills: ['D'], available: true, workHours: 4, hourlyRate: 20, efficiency: 0.7 },
];

// 默认当日任务：正常负载场景（总需求约 33h < 40h 可用，含技能交叉约束后仍可 100% 完成）
const DEFAULT_TASKS = [
  { sampleId: 'A', count: 16 },
  { sampleId: 'B', count: 10 },
  { sampleId: 'C', count: 8 },
  { sampleId: 'D', count: 4 },
  { sampleId: 'E', count: 10 },
];

module.exports = { DEFAULT_SAMPLES, DEFAULT_STAFF, DEFAULT_TASKS };
