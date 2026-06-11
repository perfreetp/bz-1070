export function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeText(value: string | null | undefined, maxLength: number = 1000): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  str = str.replace(/[\u0000-\u001F\u007F]/g, '');
  if (maxLength > 0 && str.length > maxLength) {
    str = str.slice(0, maxLength);
  }
  return str;
}

export function safeNumber(value: any, min?: number, max?: number, defaultValue: number = 0): number {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    let n = value;
    if (typeof min === 'number') n = Math.max(min, n);
    if (typeof max === 'number') n = Math.min(max, n);
    return n;
  }
  if (typeof value === 'string') {
    const n = parseFloat(value);
    if (!isNaN(n) && isFinite(n)) {
      let result = n;
      if (typeof min === 'number') result = Math.max(min, result);
      if (typeof max === 'number') result = Math.min(max, result);
      return result;
    }
  }
  return defaultValue;
}

export function truncateString(value: any, maxLength: number): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}
