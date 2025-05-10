import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Node.js runtime olarak belirt
export const runtime = 'nodejs';

// Korumalı rotalar tanımla
const protectedRoutes = [
  '/dashboard',
  '/transactions',
  '/profile',
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
  '/api/webhook/stripe', // Stripe webhook'u public olmalı
];

// URL'in korumalı bir rotada olup olmadığını kontrol et
function isProtectedRoute(path: string) {
  return protectedRoutes.some(route => path.startsWith(route));
}

// URL'in public bir rotada olup olmadığını kontrol et
function isPublicRoute(path: string) {
  return publicRoutes.some(route => path === route || path.startsWith(route));
}

// Premium içerik gerektiren rotalar
const premiumRoutes = [
  '/transactions',
  '/reports',
];

// URL'in premium bir rotada olup olmadığını kontrol et
function isPremiumRoute(path: string) {
  return premiumRoutes.some(route => path.startsWith(route));
}

// Clerk middleware'i yapılandır
export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname;
  
  // Public rotalar için işlem yok, devam et
  if (isPublicRoute(path)) {
    return NextResponse.next();
  }

  // Korumalı rotalar için kimlik doğrulama kontrolü
  if (isProtectedRoute(path)) {
    // auth.protect() kullanarak koruma sağla - giriş yapmamış kullanıcıları otomatik olarak giriş sayfasına yönlendirir
    try {
      await auth.protect();
      
      // Premium rota kontrolü
      if (isPremiumRoute(path)) {
        // Şimdilik basit bir koruma uygulayalım
        // İleride premium erişim kontrolü daha ayrıntılı yapılabilir
        
        // Not: auth.user özelliği varsayılan olarak ClerkMiddlewareAuth tipinde yok
        // Bu nedenle premium hesapları kanaldan yöneteceğiz
        const hasPremiumAccess = await checkPremiumAccess();
        
        if (!hasPremiumAccess) {
          // Premium üyelik yoksa kullanıcıyı premium planlara yönlendir
          console.log('Premium access denied - subscription required');
          return NextResponse.redirect(new URL('/pricing?premium=required', req.url));
        }
      }
    } catch (error) {
      // Yetkilendirme hatası - kullanıcı giriş yapmamış
      console.error('Authentication error:', error);
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
});

// Premium erişimi kontrol et
// Bu fonksiyon şu an geliştirme amaçlı basit bir şekilde true dönüyor
// Clerk'in auth yapısının değişmesi durumunda veya gerektiğinde burayı geliştirin
async function checkPremiumAccess(): Promise<boolean> {
  // Geliştirme aşamasında herkesin premium erişimi var kabul ediliyor
  // Bu fonksiyon ileride Clerk'in sağladığı metadata veya API ile güncellenebilir
  return true;
}

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