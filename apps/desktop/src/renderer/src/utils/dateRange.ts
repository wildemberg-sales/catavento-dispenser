export function startOfDayIso(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

export function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59.999Z`).toISOString();
}
