import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ path: ['_init'] }];
}


function getCandidateOrigins(): string[] {
  const origins: string[] = [];
  if (process.env.DEV_API_URL) {
    origins.push(process.env.DEV_API_URL.replace(/\/+$/, ''));
  }
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://127.0.0.1:4000');
    origins.push('http://localhost:4000');
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    origins.push(process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, ''));
  }
  origins.push('https://obix360.com');
  return Array.from(new Set(origins));
}

async function handleProxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path || [];
  const fullPath = pathSegments.join('/');
  const searchParams = req.nextUrl.search || '';

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');
  headers.delete('connection');
  headers.delete('content-length');

  const bodyBuffer = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();
  const candidateOrigins = getCandidateOrigins();
  let lastError: any = null;

  for (const apiOrigin of candidateOrigins) {
    // Route auth paths to /auth/..., api/ paths to /api/...
    let targetUrl: string;
    if (pathSegments[0] === 'auth' || pathSegments[0] === 'api') {
      targetUrl = `${apiOrigin}/${fullPath}`;
    } else {
      targetUrl = `${apiOrigin}/api/${fullPath}`;
    }
    if (searchParams) {
      targetUrl += searchParams;
    }

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: bodyBuffer,
        redirect: 'follow',
      });

      const data = await response.arrayBuffer();
      const responseHeaders = new Headers(response.headers);
      responseHeaders.delete('content-encoding');

      return new NextResponse(data, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err: any) {
      lastError = err;
      // If local server is not responding, loop to next candidate
      console.warn(`[API Proxy] Connection to ${targetUrl} failed (${err?.message || err}), trying next candidate...`);
    }
  }

  console.error('[API Proxy] All candidates failed. Last error:', lastError?.message || lastError);
  return NextResponse.json(
    { message: 'Proxy Error', error: lastError?.message || String(lastError) },
    { status: 502 },
  );
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const OPTIONS = handleProxy;
