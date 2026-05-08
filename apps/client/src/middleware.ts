// Middleware del client portal (Edge runtime).
// Usa la config "leggera" senza Prisma per essere edge-compatible.

import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/auth.config';

const PUBLIC_PATHS = ['/login'];

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = Boolean(req.auth);
  const isPublic = PUBLIC_PATHS.includes(nextUrl.pathname);

  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL('/', nextUrl));
  }

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
