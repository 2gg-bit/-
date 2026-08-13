import Chart from '../components/Chart.jsx';

// 统计报表页：利润构成、人员利用率、样本完成情况、累计任务趋势（加分项：图表展示）
export default function Reports({ state }) {
  const { currentSchedule: sched, historySummary, samples } = state;

  if (!sched) {
    return (
      <div>
        <h2 className="page-title">统计报表</h2>
        <p className="page-desc">暂无排班结果。请先到「智能排班」页生成并保存排班计划。</p>
        <div className="card">
          <p className="hint">保存后的排班将出现在历史记录中，用于累计任务趋势统计。</p>
        </div>
      </div>
    );
  }

  const s = sched.summary;

  // 图1：利润构成（柱状）
  const profitOption = {
    title: { text: '当日收益构成（¥）', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 50, bottom: 30 },
    xAxis: { type: 'category', data: ['样本收入', '样本直接成本', '人力成本', '净利润'] },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        barWidth: 42,
        itemStyle: { color: (p) => ['#1e3a5f', '#dc2626', '#f59e0b', '#059669'][p.dataIndex] },
        label: { show: true, position: 'top' },
        data: [s.sampleRevenue, s.sampleCost, s.laborCost, s.profit],
      },
    ],
  };

  // 图2：人员利用率（条形）
  const utilOption = {
    title: { text: '人员工时利用率（%）', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis', formatter: '{b}<br/>利用率 {c}%' },
    grid: { left: 70, right: 40, top: 50, bottom: 30 },
    xAxis: { type: 'value', max: 100 },
    yAxis: { type: 'category', data: sched.utilization.map((u) => u.staffName).reverse() },
    series: [
      {
        type: 'bar',
        barWidth: 18,
        itemStyle: { color: (p) => (p.value >= 95 ? '#f59e0b' : '#1e3a5f') },
        label: { show: true, position: 'right', formatter: '{c}%' },
        data: sched.utilization.map((u) => u.utilization).reverse(),
      },
    ],
  };

  // 图3：样本完成情况（饼图）
  const doneOption = {
    title: { text: '样本完成情况', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c} 个 ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        label: { formatter: '{b}\n{c} 个' },
        data: [
          { name: '已完成', value: s.completedCount, itemStyle: { color: '#059669' } },
          { name: '未完成(积压)', value: s.unfinishedCount, itemStyle: { color: '#dc2626' } },
        ],
      },
    ],
  };

  // 图4：累计任务趋势（历史折线）
  const hist = [...historySummary].reverse(); // 按日期正序
  const trendOption = {
    title: { text: '历史排班趋势（已保存记录）', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 50, right: 50, top: 50, bottom: 50 },
    xAxis: { type: 'category', data: hist.map((h) => h.date) },
    yAxis: [
      { type: 'value', name: '完成样本数' },
      { type: 'value', name: '利润(¥)' },
    ],
    series: [
      { name: '完成样本数', type: 'line', smooth: true, data: hist.map((h) => h.completedCount), itemStyle: { color: '#1e3a5f' } },
      { name: '利润(¥)', type: 'line', smooth: true, yAxisIndex: 1, data: hist.map((h) => h.profit), itemStyle: { color: '#059669' } },
    ],
  };

  // 各类型完成明细表数据
  const rows = Object.entries(sched.taskMap).map(([sid, total]) => ({
    sid,
    name: samples.find((x) => x.id === sid)?.name || sid,
    total,
    done: sched.completedBySample[sid] || 0,
  }));

  return (
    <div>
      <h2 className="page-title">统计报表</h2>
      <p className="page-desc">产出、利润、工作量与人员利用率可视化（对应加分项：简单图表展示）。</p>

      <div className="chart-grid">
        <div className="card"><Chart option={profitOption} height={300} /></div>
        <div className="card"><Chart option={utilOption} height={300} /></div>
        <div className="card"><Chart option={doneOption} height={300} /></div>
        <div className="card"><Chart option={trendOption} height={300} /></div>
      </div>

      <div className="card">
        <div className="card-title">历史记录摘要</div>
        {historySummary.length === 0 ? (
          <p className="hint">暂无已保存的历史排班。在「智能排班」页生成排班后点击「保存到历史」即可累计统计。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>日期</th>
                <th className="right">完成样本数</th>
                <th className="right">完成率</th>
                <th className="right">用工工时(h)</th>
                <th className="right">利润(¥)</th>
              </tr>
            </thead>
            <tbody>
              {historySummary.map((h) => (
                <tr key={h.date}>
                  <td>{h.date}</td>
                  <td className="right">{h.completedCount}</td>
                  <td className="right">{h.completionRate}%</td>
                  <td className="right">{h.totalUsedHours}</td>
                  <td className="right mono">{h.profit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">各类型完成明细（当日排班）</div>
        <table className="table">
          <thead>
            <tr>
              <th>样本类型</th>
              <th className="right">任务量</th>
              <th className="right">已完成</th>
              <th className="right">未完成</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sid}>
                <td>{r.sid} - {r.name}</td>
                <td className="right">{r.total}</td>
                <td className="right">{r.done}</td>
                <td className="right">{r.total - r.done}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
