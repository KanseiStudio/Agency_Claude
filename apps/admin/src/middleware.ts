// Middleware Next.js che impone l'autenticazione su TUTTE le route
// dell'app admin, eccetto quelle pubbliche elencate sotto.
//
// Strategia: usiamo direttamente il middleware di Auth.js (esportato da
// `auth`) e personalizziamo il comportamento via callback.
//
// Notes:
//   - le route /api/auth/* sono escluse perché sono i flussi NextAuth
//   - /login è pubblica (altrimenti loop infinito)
//   - asset statici, immagini ottimizzate e _next sono esclusi via matcher

import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const PUBLIC_PATHS = ['/login'];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = Boolean(req.auth);
  const isPublic = PUBLIC_PATHS.includes(nextUrl.pathname);

  // Utente già loggato che visita /login → manda alla home.
  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL('/', nextUrl));
  }

  // Utente non loggato su rotta protetta → manda al login,
  // mantenendo il path richiesto come callback per il post-login.
  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Esclude da matching: API routes, _next assets, file con estensione (favicon, ecc.)
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
