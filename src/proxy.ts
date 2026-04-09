import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16+ proxy convention (replaces middleware.ts). Auth is enforced via
// /api/auth/me in ClientLayout and httpOnly session cookies.
export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
