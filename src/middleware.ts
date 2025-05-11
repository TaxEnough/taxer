import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

// Korumalı rotalar tanımla
const protectedRoutes = [
  '/dashboard',
  '/transactions',
  '/profile',
  '/reports',
];

// Premium içerik gerektiren rotalar
const premiumRoutes = [
  '/transactions',
  '/reports',
];

// Public rotalar tanımla
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/pricing',
  '/about',
  '/contact',
  '/api/webhook/stripe',
  '/blog',
  '/api/blog',
];

// URL'in public bir rotada olup olmadığını kontrol et
function isPublicRoute(path: string) {
  return publicRoutes.some(route => path === route || path.startsWith(route));
}

// Clerk middleware yapılandırması
export default clerkMiddleware((auth, req) => {
  const path = req.nextUrl.pathname;
  
  // Public rotalar için herhangi bir kontrol yapma
  if (isPublicRoute(path)) {
    // Login sayfasındayken ve kullanıcı giriş yapmışsa, dashboard'a yönlendir
    if ((path === '/login' || path === '/register') && auth.userId) {
      const redirectUrl = new URL('/dashboard', req.url);
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }
  
  // Korumalı rotaya erişim kontrolü
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  const isPremiumRoute = premiumRoutes.some(route => path.startsWith(route));
  
  // Kullanıcı girişi yapmamışsa ve korumalı rota ise login'e yönlendir
  if (isProtectedRoute && !auth.userId) {
    const redirectUrl = new URL('/login', req.url);
    return NextResponse.redirect(redirectUrl);
  }
  
  // Premium içerik kontrolü
  if (isPremiumRoute && auth.userId) {
    // Geliştirme modunda premium erişime her zaman izin ver
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.next();
    }
    
    // Kullanıcı premium mi kontrol et
    try {
      const { sessionClaims } = auth;
      
      if (sessionClaims) {
        const privateMetadata = sessionClaims.privateMetadata as any || {};
        const publicMetadata = sessionClaims.publicMetadata as any || {};
        
        const privateSubscription = privateMetadata.subscription;
        const publicSubscription = publicMetadata.subscription;
        
        const hasActiveSubscription = 
          (privateSubscription && privateSubscription.status === 'active') ||
          (publicSubscription && publicSubscription.status === 'active');
          
        if (!hasActiveSubscription) {
          const redirectUrl = new URL('/pricing?premium=required', req.url);
          return NextResponse.redirect(redirectUrl);
        }
      }
    } catch (error) {
      console.error('Premium kontrol hatası:', error);
      // Hata durumunda kullanıcıyı pricing sayfasına yönlendir
      const redirectUrl = new URL('/pricing?error=subscription_check', req.url);
      return NextResponse.redirect(redirectUrl);
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