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

export async function generateSistrum(request: GenerateRequest): Promise<LyricsResult | CoverResult> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new GenerateError(data.error || 'Generation failed.', response.status);
  }
  return data as LyricsResult | CoverResult;
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
