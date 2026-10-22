import { BadRequestException } from '@nestjs/common';
import { detectFileType, requireFileType, IMAGE_TYPES, IMAGE_OR_PDF_TYPES } from './detect-file-type.util';

const pad = (head: number[]) => Buffer.concat([Buffer.from(head), Buffer.alloc(32)]);
const png = () => pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = () => pad([0xff, 0xd8, 0xff, 0xe0]);
const gif = () => pad([...Buffer.from('GIF89a', 'latin1')]);
const webp = () => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]);
const pdf = () => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(32)]);

describe('detectFileType', () => {
  it.each([
    ['png', png(), 'image/png', '.png'],
    ['jpeg', jpeg(), 'image/jpeg', '.jpg'],
    ['gif', gif(), 'image/gif', '.gif'],
    ['webp', webp(), 'image/webp', '.webp'],
    ['pdf', pdf(), 'application/pdf', '.pdf'],
  ])('recognises %s', (_n, buf, mime, ext) => {
    expect(detectFileType(buf)).toEqual({ mime, ext });
  });

  it('tolerates junk before the PDF header', () => {
    expect(detectFileType(Buffer.concat([Buffer.from('\r\n  '), pdf()]))?.mime).toBe('application/pdf');
  });

  it.each([
    ['html', '<html><script>alert(1)</script></html>'],
    ['svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ['php', '<?php system($_GET["c"]); ?>'],
    ['exe', 'MZ\x90\x00\x03\x00\x00\x00'],
    ['empty-ish', 'abc'],
  ])('does not recognise %s', (_n, text) => {
    expect(detectFileType(Buffer.from(text.padEnd(40, ' ')))).toBeNull();
  });

  it('returns null for a missing or tiny buffer', () => {
    expect(detectFileType(undefined)).toBeNull();
    expect(detectFileType(Buffer.alloc(4))).toBeNull();
  });
});

describe('requireFileType', () => {
  const msg = 'bad file';

  it('returns the detected type when content and declared type agree', () => {
    expect(requireFileType({ buffer: png(), mimetype: 'image/png' }, IMAGE_TYPES, msg)).toEqual({
      mime: 'image/png',
      ext: '.png',
    });
  });

  it('accepts the common image/jpg spelling for a JPEG', () => {
    expect(requireFileType({ buffer: jpeg(), mimetype: 'image/jpg' }, IMAGE_TYPES, msg).mime).toBe('image/jpeg');
  });

  it('rejects HTML labelled as an image', () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>'.padEnd(40, ' '));

    expect(() => requireFileType({ buffer: html, mimetype: 'image/png' }, IMAGE_TYPES, msg)).toThrow(BadRequestException);
  });

  it('rejects a real image whose declared type is different', () => {
    expect(() => requireFileType({ buffer: png(), mimetype: 'image/jpeg' }, IMAGE_TYPES, msg)).toThrow(BadRequestException);
  });

  it('rejects a PDF where only images are allowed, and accepts it where PDFs are allowed', () => {
    const file = { buffer: pdf(), mimetype: 'application/pdf' };

    expect(() => requireFileType(file, IMAGE_TYPES, msg)).toThrow(BadRequestException);
    expect(requireFileType(file, IMAGE_OR_PDF_TYPES, msg).ext).toBe('.pdf');
  });

  it('rejects a missing file', () => {
    expect(() => requireFileType(undefined, IMAGE_TYPES, msg)).toThrow(BadRequestException);
  });
});
