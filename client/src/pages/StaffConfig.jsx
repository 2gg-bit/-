import { useState } from 'react';
import { api } from '../api';

// 人员配置页：技能范围、在岗状态（手动调整）、工时、时薪、效率系数
export default function StaffConfig({ state, onRefresh, showToast }) {
  const { staff, samples } = state;
  const [list, setList] = useState(() => staff.map((p) => ({ ...p, skills: [...p.skills] })));
  const [busy, setBusy] = useState(false);

  const update = (id, patch) => {
    setList(list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const toggleSkill = (id, sid) => {
    setList(
      list.map((p) => {
        if (p.id !== id) return p;
        const skills = p.skills.includes(sid)
          ? p.skills.filter((x) => x !== sid)
          : [...p.skills, sid];
        return { ...p, skills };
      })
    );
  };

  const addStaff = () => {
    const maxId = list.reduce((m, p) => Math.max(m, p.id), 0);
    setList([
      ...list,
      { id: maxId + 1, name: '新员工', type: '实习生', skills: [], available: true, workHours: 4, hourlyRate: 20, efficiency: 0.7 },
    ]);
  };

  const removeStaff = (id) => {
    if (list.length <= 1) {
      showToast('至少保留一名人员');
      return;
    }
    setList(list.filter((p) => p.id !== id));
  };

  const save = async () => {
    if (list.some((p) => p.skills.length === 0)) {
      showToast('每名人员至少需要一项技能');
      return;
    }
    setBusy(true);
    try {
      await api.putStaff(list);
      await onRefresh();
      showToast('人员配置已保存，请到智能排班页重新排班');
    } catch (e) {
      showToast('保存失败：' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="page-title">人员配置</h2>
      <p className="page-desc">
        维护人员技能范围、在岗状态、可用工时、时薪与效率系数。
        修改「在岗」状态后，请到「智能排班」页重新生成排班（对应需求：人员状态变化后重排）。
      </p>

      <div className="card">
        <div className="card-title">
          人员列表（{list.length} 人）
          <div>
            <button className="btn btn-secondary btn-sm" onClick={addStaff}>新增人员</button>
            {' '}
            <button className="btn btn-sm" onClick={save} disabled={busy}>{busy ? '保存中…' : '保存配置'}</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>类别</th>
                <th>技能范围（可多选）</th>
                <th>在岗状态</th>
                <th className="right">可用工时(h)</th>
                <th className="right">时薪(¥/h)</th>
                <th className="right">效率系数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => update(p.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <select value={p.type} onChange={(e) => update(p.id, { type: e.target.value })}>
                      <option value="全职">全职</option>
                      <option value="实习生">实习生</option>
                    </select>
                  </td>
                  <td>
                    {samples.map((s) => (
                      <label key={s.id} style={{ marginRight: 10, whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={p.skills.includes(s.id)}
                          onChange={() => toggleSkill(p.id, s.id)}
                        />
                        {' '}{s.id} {s.name}
                      </label>
                    ))}
                  </td>
                  <td>
                    <select
                      value={p.available ? '在岗' : '离岗'}
                      onChange={(e) => update(p.id, { available: e.target.value === '在岗' })}
                      style={{ color: p.available ? '#166534' : '#b91c1c' }}
                    >
                      <option value="在岗">在岗</option>
                      <option value="离岗">离岗</option>
                    </select>
                  </td>
                  <td className="right">
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={p.workHours}
                      onChange={(e) => update(p.id, { workHours: Number(e.target.value) })}
                    />
                  </td>
                  <td className="right">
                    <input
                      type="number"
                      min="0"
                      value={p.hourlyRate}
                      onChange={(e) => update(p.id, { hourlyRate: Number(e.target.value) })}
                    />
                  </td>
                  <td className="right">
                    <input
                      type="number"
                      min="0.1"
                      step="0.05"
                      value={p.efficiency}
                      onChange={(e) => update(p.id, { efficiency: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => removeStaff(p.id)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          效率系数：熟练工 &gt; 1，可更快完成样本（实际工时 = 标准工时 ÷ 效率系数）；实习生通常 &lt; 1。
        </p>
      </div>
    </div>
  );
}
