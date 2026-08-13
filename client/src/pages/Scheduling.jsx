import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

// 智能排班页：任务量录入 → 工作量预测 → 生成排班 → 结果展示/保存
export default function Scheduling({ state, onRefresh, showToast }) {
  const { samples, staff, tasks, currentSchedule } = state;

  // 任务量编辑状态（初始化为当前任务配置）
  const [counts, setCounts] = useState(() => {
    const m = {};
    samples.forEach((s) => (m[s.id] = 0));
    tasks.forEach((t) => (m[t.sampleId] = t.count));
    return m;
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(currentSchedule);
  const [forecast, setForecast] = useState(null);

  // 任务或样本变化时同步编辑状态
  useEffect(() => {
    setCounts((prev) => {
      const m = {};
      samples.forEach((s) => (m[s.id] = prev[s.id] ?? 0));
      tasks.forEach((t) => (m[t.sampleId] = t.count));
      return m;
    });
  }, [samples, tasks]);

  const taskList = useMemo(
    () =>
      samples
        .map((s) => ({ sampleId: s.id, count: Number(counts[s.id]) || 0 }))
        .filter((t) => t.count > 0),
    [samples, counts]
  );

  const runPredict = async () => {
    try {
      const f = await api.predict(taskList);
      setForecast(f);
    } catch (e) {
      showToast('预测失败：' + e.message);
    }
  };

  const runSchedule = async () => {
    if (taskList.length === 0) {
      showToast('请先录入任务量');
      return;
    }
    setBusy(true);
    try {
      await api.putTasks(taskList);
      const r = await api.generateSchedule(taskList);
      setResult(r);
      setForecast(r.forecast);
      await onRefresh();
      showToast('排班完成');
    } catch (e) {
      showToast('排班失败：' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveSchedule = async () => {
    try {
      await api.saveSchedule();
      await onRefresh();
      showToast('已保存到历史记录');
    } catch (e) {
      showToast('保存失败：' + e.message);
    }
  };

  const s = result;
  const rate = s ? s.summary.completionRate : 0;

  return (
    <div>
      <h2 className="page-title">智能排班</h2>
      <p className="page-desc">
        第 1 步：录入当日各类型样本任务量；第 2 步：生成排班计划。
        如需调整人员（请假/离岗），请先到「人员配置」页修改，再回到本页重新排班。
      </p>

      {/* 步骤1：任务量录入 */}
      <div className="card">
        <div className="card-title">当日任务量（按样本类型汇总）</div>
        <div className="task-input-grid">
          {samples.map((sm) => (
            <div className="task-input-item" key={sm.id}>
              <div className="name">{sm.id} - {sm.name}</div>
              <div className="meta">
                单件 {sm.processMinutes} 分钟 · 价值 ¥{sm.unitValue} · 优先级 P{sm.priority}
              </div>
              <input
                type="number"
                min="0"
                value={counts[sm.id] ?? 0}
                onChange={(e) => setCounts({ ...counts, [sm.id]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="form-row" style={{ marginTop: 14 }}>
          <button className="btn btn-secondary" onClick={runPredict}>工作量预测</button>
          <button className="btn" onClick={runSchedule} disabled={busy}>
            {busy ? '正在排班…' : '智能排班'}
          </button>
          {s && (
            <button className="btn btn-secondary" onClick={saveSchedule}>保存到历史</button>
          )}
        </div>
      </div>

      {/* 工作量预测 */}
      {forecast && (
        <div className="card">
          <div className="card-title">工作量预测</div>
          <div className="stat-grid" style={{ marginBottom: 10 }}>
            <div className="stat-card">
              <div className="stat-label">总需求工时</div>
              <div className="stat-value">{forecast.demandHours} h</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">总可用工时</div>
              <div className="stat-value">{forecast.availableHours} h</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">缺口工时</div>
              <div className={'stat-value ' + (forecast.gapHours > 0 ? 'bad' : 'good')}>
                {forecast.gapHours} h
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">预计完成率</div>
              <div className={'stat-value ' + (forecast.estimatedCompletionRate >= 99 ? 'good' : 'bad')}>
                {forecast.estimatedCompletionRate}%
              </div>
            </div>
          </div>
          <div className="progress-bar">
            <div
              className={'progress-fill ' + (forecast.gapHours > 0 ? 'danger' : '')}
              style={{ width: Math.min(100, forecast.estimatedCompletionRate) + '%' }}
            />
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            在岗 {forecast.availableWorkerCount} 人。{forecast.gapHours > 0
              ? `预计将产生 ${forecast.gapHours} 小时工时缺口，部分样本可能无法安排。`
              : '工时充足，预计可完成全部任务。'}
          </p>
        </div>
      )}

      {/* 排班结果 */}
      {s && (
        <>
          <div className="card">
            <div className="card-title">排班结果总览（{s.date}）</div>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">任务完成情况</div>
                <div className="stat-value">{s.summary.completedCount} / {s.summary.totalTasks}</div>
                <div className="stat-sub">完成率 {s.summary.completionRate}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">样本收入</div>
                <div className="stat-value good">¥{s.summary.sampleRevenue.toFixed(0)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">直接成本 + 人力成本</div>
                <div className="stat-value">¥{(s.summary.sampleCost + s.summary.laborCost).toFixed(0)}</div>
                <div className="stat-sub">直接 ¥{s.summary.sampleCost.toFixed(0)} · 人力 ¥{s.summary.laborCost.toFixed(0)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">当日利润</div>
                <div className={'stat-value ' + (s.summary.profit >= 0 ? 'good' : 'bad')}>
                  ¥{s.summary.profit.toFixed(0)}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">实际用工 / 可用工时</div>
                <div className="stat-value">{s.summary.totalUsedHours} / {s.summary.totalAvailableHours} h</div>
                <div className="stat-sub">整体利用率 {s.summary.totalAvailableHours > 0 ? ((s.summary.totalUsedHours / s.summary.totalAvailableHours) * 100).toFixed(0) : 0}%</div>
              </div>
            </div>

            {/* 各类型完成情况 */}
            <table className="table" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>样本类型</th>
                  <th className="right">任务量</th>
                  <th className="right">已完成</th>
                  <th className="right">未完成(积压)</th>
                  <th>完成率</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(s.taskMap).map(([sid, total]) => {
                  const done = s.completedBySample[sid] || 0;
                  const left = total - done;
                  return (
                    <tr key={sid}>
                      <td>{sid} - {samples.find((x) => x.id === sid)?.name || ''}</td>
                      <td className="right">{total}</td>
                      <td className="right">{done}</td>
                      <td className="right">{left > 0 ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{left}</span> : 0}</td>
                      <td>
                        <div className="progress-bar" style={{ width: 140, display: 'inline-block', verticalAlign: 'middle' }}>
                          <div className={'progress-fill ' + (left > 0 ? 'warn' : '')} style={{ width: (done / total) * 100 + '%' }} />
                        </div>
                        <span className="hint" style={{ marginLeft: 8 }}>{((done / total) * 100).toFixed(0)}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 告警 */}
          <div className="card">
            <div className="card-title">告警与调整建议</div>
            {s.warnings.length === 0 ? (
              <div className="alert-item none"><span className="alert-tag">正常</span><span>当前排班无告警，人员与工时配置合理。</span></div>
            ) : (
              <div className="alert-list">
                {s.warnings.map((w, i) => (
                  <div key={i} className={'alert-item ' + (w.level === '严重' ? 'severe' : 'info')}>
                    <span className="alert-tag">[{w.level}]</span>
                    <span>{w.message} {w.suggestion}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 排班明细 */}
          <div className="card">
            <div className="card-title">排班明细（共 {s.assignments.length} 条分配记录）</div>
            <div style={{ maxHeight: 380, overflow: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>人员</th>
                    <th>类别</th>
                    <th>样本类型</th>
                    <th className="right">本件工时(h)</th>
                  </tr>
                </thead>
                <tbody>
                  {s.assignments.map((a) => {
                    const p = staff.find((x) => x.id === a.staffId);
                    return (
                      <tr key={a.seq}>
                        <td>{a.seq}</td>
                        <td>{a.staffName}</td>
                        <td>{p ? p.type : ''}</td>
                        <td>{a.sampleId} - {a.sampleName}</td>
                        <td className="right mono">{a.hours.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 人员使用状态 */}
          <div className="card">
            <div className="card-title">人员使用状态</div>
            <table className="table">
              <thead>
                <tr>
                  <th>人员</th>
                  <th className="right">已分配工时(h)</th>
                  <th className="right">可用工时(h)</th>
                  <th className="right">利用率</th>
                  <th className="right">分配样本数</th>
                </tr>
              </thead>
              <tbody>
                {s.utilization.map((u) => (
                  <tr key={u.staffId}>
                    <td>{u.staffName}</td>
                    <td className="right mono">{u.usedHours}</td>
                    <td className="right mono">{u.availableHours}</td>
                    <td className="right">
                      <div className="progress-bar" style={{ width: 120, display: 'inline-block', verticalAlign: 'middle' }}>
                        <div
                          className={'progress-fill ' + (u.utilization >= 95 ? 'warn' : '')}
                          style={{ width: u.utilization + '%' }}
                        />
                      </div>
                      <span className="hint" style={{ marginLeft: 8 }}>{u.utilization}%</span>
                    </td>
                    <td className="right">{u.assignmentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint" style={{ marginTop: 10 }}>
              说明：人员调整（在岗状态、技能、工时等）请在「人员配置」页修改后，回到本页点击「智能排班」即可重新生成。
            </p>
          </div>
        </>
      )}
    </div>
  );
}
