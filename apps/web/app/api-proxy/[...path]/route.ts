import { NextRequest, NextResponse } from 'next/server';

async function handleProxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path || [];
  const fullPath = pathSegments.join('/');

  const apiOrigin = process.env.NODE_ENV === 'development'
    ? (process.env.DEV_API_URL || 'http://127.0.0.1:4000')
    : (process.env.NEXT_PUBLIC_API_URL || 'https://obix360.com');
  const targetHost = new URL(apiOrigin).host;

  // Route auth paths to /auth/..., api/ paths to /api/...
  let targetUrl: string;
  if (pathSegments[0] === 'auth' || pathSegments[0] === 'api') {
    targetUrl = `${apiOrigin}/${fullPath}`;
  } else {
    targetUrl = `${apiOrigin}/api/${fullPath}`;
  }

  const searchParams = req.nextUrl.search;
  if (searchParams) {
    targetUrl += searchParams;
  }

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');
  headers.delete('connection');
  headers.delete('content-length');

  try {
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
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
    console.error('API Proxy Error:', targetUrl, err?.message || err);
    return NextResponse.json(
      { message: 'Proxy Error', error: err?.message || String(err) },
      { status: 502 },
    );
  }
}

export const dynamic = 'force-static';
export function generateStaticParams() {
  return [{ path: ['_init'] }];
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const OPTIONS = handleProxy;
