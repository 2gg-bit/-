import { useState } from 'react';
import { api } from '../api';

// 样本配置页：样本类型参数（处理时长、业务价值、直接成本、优先级）
export default function SamplesConfig({ state, onRefresh, showToast }) {
  const { samples } = state;
  const [list, setList] = useState(() => samples.map((s) => ({ ...s })));
  const [busy, setBusy] = useState(false);

  const update = (id, patch) => {
    setList(list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addSample = () => {
    const used = new Set(list.map((s) => s.id));
    let next = 'F';
    while (used.has(next)) next = String.fromCharCode(next.charCodeAt(0) + 1);
    setList([
      ...list,
      { id: next, name: '新样本类型', processMinutes: 30, unitValue: 100, unitCost: 40, priority: 3 },
    ]);
  };

  const removeSample = (id) => {
    if (list.length <= 1) {
      showToast('至少保留一种样本类型');
      return;
    }
    setList(list.filter((s) => s.id !== id));
  };

  const save = async () => {
    if (list.some((s) => !s.name.trim() || s.processMinutes <= 0 || s.unitValue < 0 || s.unitCost < 0 || !s.priority)) {
      showToast('请检查参数：名称不能为空，时长需大于 0');
      return;
    }
    setBusy(true);
    try {
      await api.putSamples(list);
      await onRefresh();
      showToast('样本配置已保存');
    } catch (e) {
      showToast('保存失败：' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="page-title">样本配置</h2>
      <p className="page-desc">
        维护各样本类型的处理时长、业务价值、直接成本与优先级（题目要求至少 5 类 A~E）。
        单位毛利 = 业务价值 − 直接成本，排班时优先安排高优先级、高毛利的样本。
      </p>

      <div className="card">
        <div className="card-title">
          样本类型（{list.length} 类）
          <div>
            <button className="btn btn-secondary btn-sm" onClick={addSample}>新增类型</button>
            {' '}
            <button className="btn btn-sm" onClick={save} disabled={busy}>{busy ? '保存中…' : '保存配置'}</button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>编号</th>
              <th>名称</th>
              <th className="right">处理时长(分钟)</th>
              <th className="right">业务价值(¥)</th>
              <th className="right">直接成本(¥)</th>
              <th className="right">单位毛利(¥)</th>
              <th className="right">优先级</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => update(s.id, { name: e.target.value })}
                  />
                </td>
                <td className="right">
                  <input
                    type="number"
                    min="1"
                    value={s.processMinutes}
                    onChange={(e) => update(s.id, { processMinutes: Number(e.target.value) })}
                  />
                </td>
                <td className="right">
                  <input
                    type="number"
                    min="0"
                    value={s.unitValue}
                    onChange={(e) => update(s.id, { unitValue: Number(e.target.value) })}
                  />
                </td>
                <td className="right">
                  <input
                    type="number"
                    min="0"
                    value={s.unitCost}
                    onChange={(e) => update(s.id, { unitCost: Number(e.target.value) })}
                  />
                </td>
                <td className="right mono">{s.unitValue - s.unitCost}</td>
                <td className="right">
                  <select value={s.priority} onChange={(e) => update(s.id, { priority: Number(e.target.value) })}>
                    <option value={1}>1（最高）</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => removeSample(s.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
