import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';

// Premium erişim gerektiren rotalar
const premiumRoutes = ['/transactions', '/dashboard', '/reports'];

export function middleware(req: NextRequest) {
  // Kullanıcı kimliğini ve oturum bilgilerini al
  const { userId, sessionId } = getAuth(req);
  
  // API rotaları için geçiş
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Premium rota kontrolü
  const isPremiumRoute = premiumRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route) || req.nextUrl.pathname === route
  );
  
  // Herkese açık rotalar için kontrolsüz geçiş
  if (!isPremiumRoute) {
    return NextResponse.next();
  }
  
  // Premium rotalarda oturum kontrolü
  if (!userId || !sessionId) {
    // Login sayfasına yönlendir
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Oturum varsa ve login/register sayfasındaysa dashboard'a yönlendir
  if (userId && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/register')) {
    const dashboardUrl = new URL('/dashboard', req.url);
    return NextResponse.redirect(dashboardUrl);
  }
  
  // Tüm kontrollerden geçti - devam et
  return NextResponse.next();
}

// Middleware'in çalışacağı rotalar
export const config = {
  matcher: [
    '/transactions/:path*',
    '/dashboard/:path*',
    '/reports/:path*',
    '/login',
    '/register',
  ],
}; 