const palettes: Record<string, string> = {
  "Pendiente": "badge-neutral",
  "En revisión": "badge-blue",
  "En desarrollo": "badge-purple",
  "Esperando pruebas": "badge-yellow",
  "Solucionado": "badge-green",
  "Cerrado": "badge-neutral",
  "Crítica": "badge-red",
  "Alta": "badge-orange",
  "Media": "badge-yellow",
  "Baja": "badge-green",
  "Bug": "badge-red",
  "Exploit": "badge-orange",
  "Sugerencia": "badge-blue",
  "Optimización": "badge-cyan",
  "Mejora": "badge-purple",
  "CEO": "badge-yellow",
  "Developer": "badge-purple",
  "Tester": "badge-blue",
};

export function StatusBadge({ value }: { value: string }) {
  return <span className={`badge ${palettes[value] || "badge-neutral"}`}>{value}</span>;
}
