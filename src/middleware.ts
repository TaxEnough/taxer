import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';

// Node.js runtime olarak belirt
export const runtime = 'nodejs';

// Premium içerik gerektiren rotalar
const premiumPaths = [
  '/transactions',
  '/reports',
];

// Korumalı rotaları tanımla
const isProtectedRoute = createRouteMatcher([
  '/dashboard/(.*)',
  '/transactions/(.*)',
  '/profile/(.*)',
  '/reports/(.*)',
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

// Clerk middleware ile kimlik doğrulamayı yönet
export default clerkMiddleware((auth, req) => {
  // Eğer geçerli URL public bir rota ise, devam et
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Korumalı rotalar için kimlik doğrulama kontrolü
  if (isProtectedRoute(req)) {
    // Kullanıcı oturum açmamışsa, login sayfasına yönlendir
    if (!auth.userId) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    
    // Premium rota kontrolü
    const path = req.nextUrl.pathname;
    const isPremiumRoute = premiumPaths.some(route => path.startsWith(route));
    
    if (isPremiumRoute) {
      // Kullanıcının abonelik bilgilerini al
      const userMeta = auth.user?.publicMetadata || {};
      const subscription = userMeta.subscription as any;
      
      // Premium erişimi kontrol et
      if (!subscription || subscription.status !== 'active') {
        // Premium üyelik yoksa premium plana yönlendir
        console.log('Premium access denied - subscription required');
        return NextResponse.redirect(new URL('/pricing?premium=required', req.url));
      }
    }
  }

  return NextResponse.next();
});

// Middleware konfigürasyonu - hangi rotalar için çalışacağını belirt
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (public images folder)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|images|public|assets).*)',
  ],
}; 