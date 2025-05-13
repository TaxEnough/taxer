import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Korumalı premium sayfalar - middleware tarafından kontrol edilecek
const PREMIUM_PATHS = ['/dashboard', '/transactions', '/reports'];

// Middleware function
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Premium rota kontrolü
  const isPremiumPath = PREMIUM_PATHS.some(path => 
    pathname === path || pathname.startsWith(`${path}/`)
  );
  
  // Premium rota değilse, normal akışa devam et
  if (!isPremiumPath) {
    return NextResponse.next();
  }
  
  // Cookie kontrolü - oturum açık mı?
  const hasClerkSession = checkClerkSession(request);
  
  // Premium içeriğe erişmek istiyor ve oturum açık değilse
  if (isPremiumPath && !hasClerkSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Tüm kontroller geçildi, devam et
  return NextResponse.next();
}

// Clerk oturum durumunu çerezlerden kontrol eden yardımcı fonksiyon
function checkClerkSession(request: NextRequest): boolean {
  // Clerk oturum çerezlerini kontrol et
  const hasSession = request.cookies.has('__session') || 
                     request.cookies.has('__clerk_db_jwt') ||
                     request.cookies.has('__client');
  
  // Cookie olmasa bile, authorization header'dan da kontrol et
  if (!hasSession) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && (authHeader.startsWith('Bearer ') || authHeader.startsWith('Clerk '))) {
      return true;
    }
  }
  
  return hasSession;
}

// Matcher - hangi rotalarda çalışacağını belirtir
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/transactions/:path*',
    '/reports/:path*',
  ],
}; 