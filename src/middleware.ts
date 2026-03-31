import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Auth protection is handled client-side in ClientLayout.tsx using document.cookie.
// This middleware is kept minimal to avoid Vercel Edge cookie-reading issues
// that caused sessions to be dropped on client-side navigation.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
