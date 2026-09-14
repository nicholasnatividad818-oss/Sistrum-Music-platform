export type GenerateKind = 'lyrics' | 'cover';

export interface GenerateRequest {
  kind: GenerateKind;
  title: string;
  artist?: string;
  genre?: string;
  mood?: string;
  theme?: string;
  lyrics?: string;
}

export interface LyricsResult {
  kind: 'lyrics';
  lyrics: string;
}

export interface CoverResult {
  kind: 'cover';
  mimeType: string;
  imageDataUrl: string;
}

export class GenerateError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

export async function compactCoverDataUrl(dataUrl: string, size = 768, quality = 0.82): Promise<string> {
  if (typeof document === 'undefined' || !dataUrl.startsWith('data:image')) return dataUrl;
  if (dataUrl.length < 180_000) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function generateSistrum(request: GenerateRequest): Promise<LyricsResult | CoverResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new GenerateError(data.error || 'Generation failed.', response.status);
    }
    if (data.kind === 'cover' && typeof data.imageDataUrl === 'string') {
      data.imageDataUrl = await compactCoverDataUrl(data.imageDataUrl);
    }
    return data as LyricsResult | CoverResult;
  } catch (err) {
    if (err instanceof GenerateError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new GenerateError('Generation timed out. Try lyrics first, then the cover.', 408);
    }
    throw new GenerateError('Generation failed.', 0);
  } finally {
    window.clearTimeout(timer);
  }
}

export const GENERATE_GENRES = [
  'Electronic',
  'Synthwave',
  'Lo-Fi',
  'House',
  'Ambient',
  'Trap',
  'Future Bass',
  'Chillhop',
  'Indie',
  'R&B',
  'Hip-Hop',
  'Pop',
  'Rock'
] as const;
