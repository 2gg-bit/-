import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

// ECharts 封装组件：传入 option 与高度，自动处理 resize 与销毁
export default function Chart({ option, height = 300 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current);
    }
    chartRef.current.setOption(option, true);
  }, [option]);

  useEffect(() => {
    const onResize = () => chartRef.current && chartRef.current.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, []);

  return <div ref={ref} style={{ width: '100%', height }} />;
}
