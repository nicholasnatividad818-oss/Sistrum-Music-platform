/** Shared by the browser and the Vite server. Rejects example values from .env.example. */
export function usableEnv(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('your-project') ||
    lower.includes('your_project') ||
    lower.startsWith('your-') ||
    lower.startsWith('your_') ||
    lower.startsWith('my_') ||
    lower === 'changeme' ||
    lower.includes('placeholder')
  ) {
    return null;
  }
  return trimmed;
}
