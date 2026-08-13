import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import Dashboard from './pages/Dashboard.jsx';
import Scheduling from './pages/Scheduling.jsx';
import StaffConfig from './pages/StaffConfig.jsx';
import SamplesConfig from './pages/SamplesConfig.jsx';
import Reports from './pages/Reports.jsx';

const NAV = [
  { key: 'dashboard', label: '工作看板' },
  { key: 'scheduling', label: '智能排班' },
  { key: 'staff', label: '人员配置' },
  { key: 'samples', label: '样本配置' },
  { key: 'reports', label: '统计报表' },
];

// 简单 hash 路由：URL 形如 #/scheduling，支持直接定位页面与浏览器前进后退
const getPageFromHash = () => {
  const h = window.location.hash.replace(/^#\//, '');
  return NAV.some((n) => n.key === h) ? h : 'dashboard';
};

export default function App() {
  const [page, setPage] = useState(getPageFromHash);
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const onHash = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (key) => {
    window.location.hash = '/' + key;
  };

  const refresh = useCallback(async () => {
    try {
      const s = await api.getState();
      setState(s);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  if (!state) {
    return <div className="loading">正在加载数据……</div>;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">检测实验室简易排班管理系统</div>
        <div className="topbar-actions">
          <button className="btn" onClick={refresh}>刷新数据</button>
          <button
            className="btn btn-warn"
            onClick={async () => {
              if (window.confirm('确定恢复默认数据吗？样本、人员与任务配置将被覆盖（历史统计保留）。')) {
                await api.reset();
                await refresh();
                showToast('已恢复默认数据');
              }
            }}
          >
            恢复默认数据
          </button>
        </div>
      </header>

      <div className="layout">
        <nav className="sidebar">
          {NAV.map((item) => (
            <button
              key={item.key}
              className={'nav-item' + (page === item.key ? ' active' : '')}
              onClick={() => navigate(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="content">
          {error && <div className="error-banner">数据加载失败：{error}（请确认后端服务已启动）</div>}
          {page === 'dashboard' && <Dashboard state={state} onNavigate={navigate} onRefresh={refresh} showToast={showToast} />}
          {page === 'scheduling' && <Scheduling state={state} onRefresh={refresh} showToast={showToast} />}
          {page === 'staff' && <StaffConfig state={state} onRefresh={refresh} showToast={showToast} />}
          {page === 'samples' && <SamplesConfig state={state} onRefresh={refresh} showToast={showToast} />}
          {page === 'reports' && <Reports state={state} />}
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
