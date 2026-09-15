import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const MONITOR_PATHS = ['/fluide/planning', '/fluide/moniteurs'];

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const role = payload.role as string;
    const enseigne = (payload.enseigne as string) || 'fluide';
    const email = (payload.email as string) || '';
    const { pathname } = request.nextUrl;

    const isAravis = enseigne === 'aravis' || role === 'aravis';
    const onAravisPath = pathname.startsWith('/aravis');
    const onFluide = pathname.startsWith('/fluide');

    // Julien peut accéder aux deux backoffices pour le débogage
    const isSuperAdmin = email === 'juwirtz@gmail.com';

    if (!isSuperAdmin) {
      // Aravis → interdit sur /fluide
      if (isAravis && onFluide) {
        return NextResponse.redirect(new URL('/aravis/planning', request.url));
      }
      // Fluide → interdit sur /aravis
      if (!isAravis && onAravisPath) {
        return NextResponse.redirect(new URL('/fluide/planning', request.url));
      }
    }

    const isMonitor = role === 'monitor' || role === 'permanent';
    const onMonitorPath = MONITOR_PATHS.some(p => pathname.startsWith(p));

    if (isMonitor && !onMonitorPath && !onAravisPath) {
      return NextResponse.redirect(new URL('/fluide/planning', request.url));
    }

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

export const config = {
  matcher: [
    '/fluide/:path*',
    '/aravis/:path*',
  ],
};
