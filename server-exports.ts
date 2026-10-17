export function csvCell(value: string | number | boolean | null | undefined): string {
  const normalized = String(value ?? '').replace(/\r\n?/g, '\n').replace(/\n/g, ' ');
  const safe = /^[\s]*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${safe.replace(/"/g, '""')}"`;
}