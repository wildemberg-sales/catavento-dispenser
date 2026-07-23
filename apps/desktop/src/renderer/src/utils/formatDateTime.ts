function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDateTime(value: string | number | Date): { date: string; time: string } {
  const d = value instanceof Date ? value : new Date(value);
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
  };
}
