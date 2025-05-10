import { authMiddleware } from '@clerk/nextjs';
import { NextResponse } from 'next/server';

export default authMiddleware({
  // Herkese açık sayfalar (kimlik doğrulama gerektirmeyen)
  publicRoutes: [
    '/',
    '/login',
    '/register',
    '/pricing',
    '/about',
    '/contact',
    '/api/webhook/stripe', // Stripe webhook'u public olmalı
  ],
  
  // Auth kontrolünden sonra çalışır
  afterAuth(auth, req) {
    // Premium sayfalar için kontrol
    // İleride premium özellikler için Stripe entegrasyonu 
    // yapıldığında burayı güncelleyeceğiz
    if (
      // Transactions sayfasına erişim kontrolü
      req.nextUrl.pathname.startsWith('/transactions') && 
      (!auth.userId)
    ) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }
});

export const config = {
  matcher: [
    // Middleware'in çalışacağı rotalar
    '/dashboard/:path*',
    '/transactions/:path*',
    '/profile/:path*',
    '/reports/:path*',
    '/login',
    '/register',
  ],
}; 