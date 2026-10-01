'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Renders a QR code in the browser. These codes encode guest-ordering and
 * WhatsApp links, so they must not be sent to a third-party QR image service
 * (which used to receive every shop's table and takeaway links).
 */
export function QrImage({
  value,
  size = 300,
  alt,
  className,
}: {
  value: string;
  size?: number;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setSrc('');
      return;
    }
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) return <div className={className} aria-label={alt} />;
  return <img src={src} alt={alt} className={className} />;
}
