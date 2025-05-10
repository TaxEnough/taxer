import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Korumalı rotaları tanımla
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/transactions(.*)',
  '/profile(.*)',
  '/reports(.*)',
]);

// Herkese açık rotaları tanımla
const isPublicRoute = createRouteMatcher([
  '/',
  '/login',
  '/register',
  '/pricing',
  '/about',
  '/contact',
  '/api/webhook/stripe', // Stripe webhook'u public olmalı
]);

export default clerkMiddleware(async (auth, req) => {
  // Eğer geçerli URL public bir rota ise, devam et
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Korumalı rotalar için kimlik doğrulama kontrolü
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Temel rotalar için matcher
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    
    // Korumalı rotalar - özel olarak belirtiliyor
    '/dashboard/:path*',
    '/transactions/:path*',
    '/profile/:path*',
    '/reports/:path*',
    
    // Açık rotalar - ziyaretçiler görebilir ancak auth kontrolü yapılır
    '/login',
    '/register',
    '/pricing', 
    '/about',
  ],
}; 