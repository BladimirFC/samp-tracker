import type { Metrics } from "../types";

const chartColors = ["#ef4444", "#f59e0b", "#8b5cf6", "#38bdf8", "#22c55e", "#64748b"];

export function DistributionChart({ title, subtitle, data, onSelect }: { title: string; subtitle: string; data: Array<{ label: string; value: number }>; onSelect?: (label: string) => void }) {
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));
  return <section className="panel chart-panel"><div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="distribution-chart">{data.map((item, index) => <button className="distribution-row" type="button" key={item.label} onClick={() => onSelect?.(item.label)} disabled={!onSelect}><span className="distribution-label"><i style={{ background: chartColors[index % chartColors.length] }} />{item.label}</span><span className="distribution-track"><i style={{ width: `${Math.max(item.value ? 4 : 0, item.value / total * 100)}%`, background: chartColors[index % chartColors.length] }} /></span><strong>{item.value}</strong></button>)}</div></section>;
}

export function TrendChart({ metrics }: { metrics: Metrics }) {
  const values = metrics.days.slice(-14);
  const width = 600;
  const height = 170;
  const max = Math.max(1, ...values.map((item) => item.total));
  const points = values.map((item, index) => `${index / Math.max(1, values.length - 1) * width},${height - item.total / max * 130 - 18}`).join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  return <section className="panel chart-panel trend-panel"><div className="panel-heading"><div><h2>Ritmo de reportes</h2><p>Creación diaria durante los últimos 14 días.</p></div><span className="chart-total">{metrics.created7}<small>esta semana</small></span></div><div className="trend-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tendencia de reportes creados"><defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b5cf6" stopOpacity=".35"/><stop offset="1" stopColor="#8b5cf6" stopOpacity="0"/></linearGradient></defs><polygon points={area} fill="url(#trend-fill)"/><polyline points={points} fill="none" stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{values.map((item, index) => <circle key={item.date} cx={index / Math.max(1, values.length - 1) * width} cy={height - item.total / max * 130 - 18} r="4" fill="#09090d" stroke="#c4b5fd" strokeWidth="3"><title>{item.date}: {item.total}</title></circle>)}</svg><div className="trend-labels"><span>{values[0]?.date.slice(5)}</span><span>{values[values.length - 1]?.date.slice(5)}</span></div></div></section>;
}
