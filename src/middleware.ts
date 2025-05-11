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
    const isAuthenticated = await isUserAuthenticated(auth);
    
    if ((path === '/login' || path === '/register') && isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // Korumalı rotalar için kimlik doğrulama kontrolü
  if (isProtectedRoute(path)) {
    try {
      // Kimlik doğrulama kontrolü
      await auth.protect();
      
      // Premium rota kontrolü
      if (isPremiumRoute(path)) {
        console.log("Premium rota erişimi kontrol ediliyor:", path);
        
        // Bu geçici bir çözüm - geliştirme aşamasında tüm kullanıcılara premium erişim ver
        if (process.env.NODE_ENV === 'development') {
          console.log("Geliştirme modu: Premium erişim izni verildi");
          return NextResponse.next();
        }
        
        // Clerk'in session bilgilerini al - doğrudan auth nesnesi üzerinden erişim
        try {
          // auth.has() veya manual olarak premium durumunu kontrol et
          // Aktif abonelik için her zaman erişime izin ver - geliştirme aşamasında
          
          // Premium erişim kontrolü yapmak için ayrı bir middleware veya webhooklar kullanılmalıdır
          // Şu an için geçici bir çözüm olarak premium erişim veriyoruz
          console.log("Aktif abonelik varsayıldı, erişim izni verildi");
          return NextResponse.next();
          
          // Gerçek bir uygulamada, aşağıdaki gibi bir kontrol yapılabilir:
          /*
          const hasAccess = await auth.has({
            permission: "premium:access",
          });
          
          if (hasAccess) {
            return NextResponse.next();
          } else {
            return NextResponse.redirect(new URL('/pricing?premium=required', req.url));
          }
          */
        } catch (error) {
          // Subscription kontrolünde hata, loglama yap
          console.error("Abonelik kontrolü hatası:", error);
          
          // Güvenli davranış olarak pricing sayfasına yönlendir
          attemptData.count += 1;
          redirectAttempts.set(routeKey, attemptData);
          return NextResponse.redirect(new URL('/pricing?error=subscription_check', req.url));
        }
      }
      
      // Premium olmayan korumalı sayfa - devam et
      return NextResponse.next();
    } catch (error) {
      // Yetkilendirme hatası - kullanıcı giriş yapmamış
      console.error('Kimlik doğrulama hatası:', error);
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