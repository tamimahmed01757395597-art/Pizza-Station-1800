export function tableDisplayLabel(value: string) {
  const label = value.trim();
  return /^table(?:\s|$)/i.test(label) ? label : `Table ${label}`;
}
