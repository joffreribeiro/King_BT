/** Máscara "DDMMAAAA" → "DD/MM/AAAA" enquanto o usuário digita. */
export function maskDate(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "DD/MM/AAAA" → "AAAA-MM-DD" se for uma data real do calendário; senão null. */
export function parseBrDate(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2100) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Máscara "HHMM" → "HH:MM". */
export function maskTime(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** "HH:MM" válido (00:00–23:59) ou null. */
export function parseTime(text: string): string | null {
  const m = /^(\d{2}):(\d{2})$/.exec(text.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return text.trim();
}

/** Data de hoje (fuso local) como "AAAA-MM-DD" e "DD/MM/AAAA". */
export function todayLocal(now = new Date()): { iso: string; br: string } {
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    iso: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`,
    br: `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`,
  };
}
