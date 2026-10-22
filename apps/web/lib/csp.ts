/**
 * Content-Security-Policy for the web app (the Capacitor export can't serve headers).
 *
 * The session tokens live in localStorage, so the aim is to make injected script
 * hard to run and, above all, hard to phone home with:
 *  - connect-src is an allowlist (this origin, the API, the mailer, Google sign-in),
 *    so script that did get in cannot POST tokens to an arbitrary server.
 *  - script-src only loads from this origin and Google's sign-in client; object-src
 *    and base-uri are closed; framing and form posts are limited to this origin.
 *
 * Known gap: Next.js hydrates with inline scripts and the app uses inline styles,
 * so script-src/style-src keep 'unsafe-inline'. Removing it needs per-request
 * nonces (middleware + dynamic rendering), which this static-friendly app avoids.
 * img-src stays broad (https:) because product images come from an object-storage
 * host configured per deployment.
 */
export interface CspOptions {
  isDev: boolean;
  /** Extra origins the browser may call, e.g. the API and mailer base URLs. */
  connectOrigins: Array<string | undefined>;
}

/** "https://api.example.com/v1" -> "https://api.example.com"; anything unparsable is dropped. */
export function toOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

export function buildCsp({ isDev, connectOrigins }: CspOptions): string {
  const connect = Array.from(
    new Set(
      [
        "'self'",
        'https://accounts.google.com',
        // The landing page's 3D scenes use drei's <Environment preset="studio">, which
        // fetches its lighting map from this host at runtime. Self-host the file
        // (<Environment files="/...">) and remove this entry to drop the dependency.
        'https://raw.githack.com',
        ...connectOrigins.map(toOrigin),
        // Hot reload talks to the dev server over a websocket.
        ...(isDev ? ['ws:', 'http://localhost:*', 'http://127.0.0.1:*'] : []),
      ].filter((v): v is string => !!v),
    ),
  );

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      'https://accounts.google.com/gsi/client',
      // React's dev tooling evaluates code for stack traces; never in production.
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com/gsi/style'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'media-src': ["'self'", 'blob:', 'data:'],
    'connect-src': connect,
    'frame-src': ['https://accounts.google.com'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}
