const SENSITIVE = /(secret|token|code|verifier|password|authorization|cookie|state)/i;

export function redact(value, depth = 0) {
  if (value == null || typeof value !== 'object' || depth > 4) return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  const out = Array.isArray(value) ? [] : {};
  for (const [key, inner] of Object.entries(value)) out[key] = SENSITIVE.test(key) ? '[redacted]' : redact(inner, depth + 1);
  return out;
}

export function log(level, message, details) {
  if (process.env.VIEWERWORKS_SILENT) return;
  const line = { level, message, time: new Date().toISOString(), ...(details ? { details: redact(details) } : {}) };
  (level === 'error' ? console.error : console.log)(JSON.stringify(line));
}
