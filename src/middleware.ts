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

// Sonsuz yönlendirme döngüsünü önlemek için kullanılan yerel cache
const redirectAttempts = new Map<string, { count: number, timestamp: number }>();

// Clerk middleware'i yapılandır
export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname;
  
  // Redirect döngüsünü önlemek için URL kontrolü
  // IP ve yol tabanlı unique key oluştur
  const clientIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown';
  const routeKey = `${clientIp}:${path}`;
  
  // Redirect sayacını al veya oluştur
  const now = Date.now();
  const attemptData = redirectAttempts.get(routeKey) || { count: 0, timestamp: now };
  
  // Cache'i temizle (5 dakikadan eski girişleri sil)
  if (now - attemptData.timestamp > 5 * 60 * 1000) {
    attemptData.count = 0;
    attemptData.timestamp = now;
  }
  
  // Eğer aynı URL'e çok fazla yönlendirme varsa (döngü), doğrudan geçiş yap
  if (attemptData.count > 3) {
    console.log(`Olası yönlendirme döngüsü algılandı: ${routeKey}, geçiş yapılıyor`);
    redirectAttempts.delete(routeKey); // Sayacı sıfırla
    return NextResponse.next();
  }
  
  // Public rotalar için işlem yok, devam et
  if (isPublicRoute(path)) {
    // Login sayfasındayken ve kullanıcı giriş yapmışsa, dashboard'a yönlendir
    // auth.protect() yerine isAuthenticated kullan
    const isAuthenticated = await isUserAuthenticated(auth);
    
    if ((path === '/login' || path === '/register') && isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // Korumalı rotalar için kimlik doğrulama kontrolü
  if (isProtectedRoute(path)) {
    try {
      // auth.protect() kullanarak koruma sağla
      await auth.protect();
      
      // Premium rota kontrolü
      if (isPremiumRoute(path)) {
        // Premium erişim kontrolü
        const hasPremiumAccess = await checkPremiumAccess(auth);
        
        if (!hasPremiumAccess) {
          // Premium üyelik yoksa kullanıcıyı premium planlara yönlendir
          // Aynı URL'e yönlendirme sayısını artır
          attemptData.count += 1;
          redirectAttempts.set(routeKey, attemptData);
          console.log(`Premium erişim reddedildi - ${routeKey}, deneme: ${attemptData.count}`);
          return NextResponse.redirect(new URL('/pricing?premium=required', req.url));
        }
      }
    } catch (error) {
      // Yetkilendirme hatası - kullanıcı giriş yapmamış
      console.error('Authentication error:', error);
      // Aynı URL'e yönlendirme sayısını artır
      attemptData.count += 1;
      redirectAttempts.set(routeKey, attemptData);
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
});

// Kullanıcının giriş yapmış olup olmadığını kontrol et
async function isUserAuthenticated(auth: any): Promise<boolean> {
  try {
    // auth.protect() çağrısının hata almaması kontrol için yeterli
    await auth.protect();
    return true;
  } catch (error) {
    return false;
  }
}

// Premium erişimi kontrol et
async function checkPremiumAccess(auth: any): Promise<boolean> {
  // Kullanıcı meta verilerini kontrol et
  try {
    if (auth.user && auth.user.publicMetadata) {
      const metadata = auth.user.publicMetadata;
      
      // Subscription durumunu kontrol et
      if (metadata.subscription && metadata.subscription.status === 'active') {
        return true;
      }
      
      // Varsayılan olarak geliştirme aşamasında premium erişim olmadığını varsayalım
      // NOT: Gerçek uygulamada, premium kontrolü daha kapsamlı yapılmalıdır
      return false;
    }
    
    // Metadata yoksa veya kontrol edilemiyorsa
    // Geliştirme aşamasında premium erişim varsayalım
    return process.env.NODE_ENV === 'development';
  } catch (error) {
    console.error('Premium access check error:', error);
    
    // Hata durumunda geliştirme ortamında erişime izin ver
    return process.env.NODE_ENV === 'development';
  }
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