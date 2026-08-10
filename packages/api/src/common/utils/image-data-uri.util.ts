import * as fs from 'fs';
import * as path from 'path';
import { uploadsFilePathFromUrl } from './public-url.util';

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * Puppeteer's page.setContent() has no base URL (effectively about:blank), so a
 * relative <img src="/uploads/..."> can't resolve the way it does in the browser.
 * Inline the image as a base64 data URI instead, read straight off disk.
 */
export function loadImageDataUri(url: string | null | undefined): string | null {
  if (!url) return null;
  const mimeType = IMAGE_MIME_TYPES[path.extname(url).toLowerCase()];
  if (!mimeType) return null;
  const filePath = uploadsFilePathFromUrl(url);
  try {
    const buffer = fs.readFileSync(filePath);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}
