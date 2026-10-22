import { BadRequestException } from '@nestjs/common';

export type DetectedFileType = { mime: string; ext: string };

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Identifies an upload from its leading bytes. Clients choose both the
 * `Content-Type` and the file name, so neither says what the bytes really are;
 * trusting them lets someone store an HTML/SVG/script payload that the storage
 * host then serves back with a browser-runnable type. Only formats the app
 * actually accepts are recognised — anything else (SVG, HTML, executables) is
 * unknown by construction.
 */
export function detectFileType(buffer?: Buffer): DetectedFileType | null {
  if (!buffer || buffer.length < 12) return null;

  if (buffer.subarray(0, 8).equals(PNG)) return { mime: 'image/png', ext: '.png' };
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' };

  const head6 = buffer.subarray(0, 6).toString('latin1');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return { mime: 'image/gif', ext: '.gif' };

  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp' };
  }

  // PDFs may carry a few bytes of junk before the header; the spec allows 1024.
  if (buffer.subarray(0, 1024).includes('%PDF-')) return { mime: 'application/pdf', ext: '.pdf' };

  return null;
}

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const IMAGE_OR_PDF_TYPES = [...IMAGE_TYPES, 'application/pdf'] as const;

/**
 * Verifies an uploaded file by content and returns the type to store it as.
 * The declared mimetype must agree with the content too, so a mislabelled file
 * is rejected rather than silently relabelled.
 */
export function requireFileType(
  file: { buffer?: Buffer; mimetype?: string } | undefined,
  allowed: readonly string[],
  message: string,
): DetectedFileType {
  const detected = detectFileType(file?.buffer);
  if (!detected || !allowed.includes(detected.mime) || detected.mime !== normaliseMime(file?.mimetype)) {
    throw new BadRequestException(message);
  }
  return detected;
}

function normaliseMime(mime?: string): string {
  const m = (mime ?? '').toLowerCase().trim();
  return m === 'image/jpg' || m === 'image/pjpeg' ? 'image/jpeg' : m;
}
