import { NextRequest, NextResponse } from 'next/server';

async function handleProxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path || [];
  const fullPath = pathSegments.join('/');

  // Route auth paths to https://obix360.com/auth/..., api/ paths to https://obix360.com/api/...
  let targetUrl: string;
  if (pathSegments[0] === 'auth' || pathSegments[0] === 'api') {
    targetUrl = `https://obix360.com/${fullPath}`;
  } else {
    targetUrl = `https://obix360.com/api/${fullPath}`;
  }

  const searchParams = req.nextUrl.search;
  if (searchParams) {
    targetUrl += searchParams;
  }

  const headers = new Headers(req.headers);
  headers.delete('origin');
  headers.delete('referer');
  headers.set('host', 'obix360.com');

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
    return NextResponse.json(
      { message: 'Proxy Error', error: err.message },
      { status: 502 },
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const OPTIONS = handleProxy;
