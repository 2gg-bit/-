// 工作看板：快速掌握当日任务量、可用人员、排班概况与告警
export default function Dashboard({ state, onNavigate, showToast }) {
  const { samples, staff, tasks, currentSchedule, totalCompletedAccumulated, historySummary } = state;

  const onDuty = staff.filter((p) => p.available);
  const totalAvailableHours = onDuty.reduce((s, p) => s + p.workHours, 0);
  const totalTasks = tasks.reduce((s, t) => s + t.count, 0);
  const demandHours = tasks.reduce((s, t) => {
    const conf = samples.find((x) => x.id === t.sampleId);
    return s + (conf ? (conf.processMinutes / 60) * t.count : 0);
  }, 0);

  const sched = currentSchedule;
  const completionRate = sched ? sched.summary.completionRate : null;

  return (
    <div>
      <h2 className="page-title">工作看板</h2>
      <p className="page-desc">快速掌握当日任务量与可用人员情况。点击「去排班」进入智能排班。</p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">当日任务总量</div>
          <div className="stat-value">{totalTasks} 个</div>
          <div className="stat-sub">预计需求工时 {demandHours.toFixed(1)} h</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">在岗人员</div>
          <div className="stat-value">{onDuty.length} 人</div>
          <div className="stat-sub">总可用工时 {totalAvailableHours.toFixed(1)} h</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">最新排班完成率</div>
          <div className={'stat-value ' + (completionRate === null ? '' : completionRate >= 99 ? 'good' : completionRate >= 80 ? '' : 'bad')}>
            {completionRate === null ? '—' : completionRate.toFixed(0) + '%'}
          </div>
          <div className="stat-sub">{sched ? `${sched.summary.completedCount}/${sched.summary.totalTasks} 个样本` : '尚未排班'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">最新排班利润</div>
          <div className={'stat-value ' + (sched && sched.summary.profit >= 0 ? 'good' : 'bad')}>
            {sched ? '¥' + sched.summary.profit.toFixed(0) : '—'}
          </div>
          <div className="stat-sub">收入 - 直接成本 - 人力成本</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">历史累计完成样本</div>
          <div className="stat-value">{totalCompletedAccumulated} 个</div>
          <div className="stat-sub">已保存 {historySummary.length} 天排班记录</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">当日任务分布（按样本类型）</div>
        {tasks.length === 0 ? (
          <p className="hint">暂无任务，请到「智能排班」页录入任务量。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>样本类型</th>
                <th>名称</th>
                <th className="right">任务量</th>
                <th className="right">单件工时(分钟)</th>
                <th className="right">需求工时(h)</th>
                <th>优先级</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const conf = samples.find((x) => x.id === t.sampleId);
                if (!conf) return null;
                return (
                  <tr key={t.sampleId}>
                    <td>{t.sampleId}</td>
                    <td>{conf.name}</td>
                    <td className="right">{t.count}</td>
                    <td className="right">{conf.processMinutes}</td>
                    <td className="right">{((conf.processMinutes / 60) * t.count).toFixed(1)}</td>
                    <td>{'P' + conf.priority}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          最新排班告警
          <button className="btn btn-sm" onClick={() => onNavigate('scheduling')}>去排班</button>
        </div>
        {!sched ? (
          <p className="hint">暂无排班结果。请先到「智能排班」页生成排班计划。</p>
        ) : sched.warnings.length === 0 ? (
          <div className="alert-item none"><span className="alert-tag">正常</span><span>当前排班无告警，人员与工时配置合理。</span></div>
        ) : (
          <div className="alert-list">
            {sched.warnings.map((w, i) => (
              <div key={i} className={'alert-item ' + (w.level === '严重' ? 'severe' : 'info')}>
                <span className="alert-tag">[{w.level}]</span>
                <span>{w.message} {w.suggestion}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">人员概览</div>
        <table className="table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>类别</th>
              <th>技能范围</th>
              <th>在岗状态</th>
              <th className="right">可用工时(h)</th>
              <th className="right">时薪(¥)</th>
              <th className="right">效率系数</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td><span className={'tag ' + (p.type === '全职' ? 'tag-full' : 'tag-intern')}>{p.type}</span></td>
                <td>{p.skills.join('、')}</td>
                <td>{p.available ? '在岗' : '离岗'}</td>
                <td className="right">{p.workHours}</td>
                <td className="right">{p.hourlyRate}</td>
                <td className="right">{p.efficiency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
