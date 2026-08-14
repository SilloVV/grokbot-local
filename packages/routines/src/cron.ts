/** Minimal 5-field cron matcher: minute hour dom month dow. Supports *, lists, ranges, steps. */

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  for (const part of field.split(",")) {
    let step = 1;
    let range = part;
    const slash = part.indexOf("/");
    if (slash !== -1) {
      range = part.slice(0, slash);
      step = Number(part.slice(slash + 1));
      if (!Number.isFinite(step) || step < 1) return false;
    }
    if (range === "*") {
      if (value >= min && value <= max && (value - min) % step === 0) return true;
      continue;
    }
    const dash = range.indexOf("-");
    if (dash !== -1) {
      const a = Number(range.slice(0, dash));
      const b = Number(range.slice(dash + 1));
      if (value >= a && value <= b && (value - a) % step === 0) return true;
      continue;
    }
    const n = Number(range);
    if (n === value && (step === 1 || (value - min) % step === 0)) return true;
  }
  return false;
}

export function cronMatches(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;
  if (!minute || !hour || !dom || !month || !dow) return false;
  return (
    matchField(minute, date.getMinutes(), 0, 59) &&
    matchField(hour, date.getHours(), 0, 23) &&
    matchField(dom, date.getDate(), 1, 31) &&
    matchField(month, date.getMonth() + 1, 1, 12) &&
    matchField(dow, date.getDay(), 0, 6)
  );
}
