import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Node.js runtime olarak belirt
export const runtime = 'nodejs';

// Premium içerik gerektiren rotalar
const premiumPaths = [
  '/transactions',
  '/reports',
];

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

// Clerk middleware ile kimlik doğrulamayı yönet
export default clerkMiddleware(async (auth, req) => {
  // Eğer geçerli URL public bir rota ise, devam et
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Korumalı rotalar için kimlik doğrulama kontrolü
  if (isProtectedRoute(req)) {
    // auth.protect() kullanarak direkt yetkilendirme yapıyoruz
    // bu şekilde userId özelliğine erişim hatası almıyoruz
    await auth.protect();
    
    // Premium rota kontrolü
    const path = req.nextUrl.pathname;
    const isPremiumRoute = premiumPaths.some(route => path.startsWith(route));
    
    if (isPremiumRoute) {
      try {
        // Premium içeriği koruma - iki farklı yöntem:
        // 1. Basit erişim kontrolü - kullanıcı giriş yapmış mı?
        await auth.protect();
        
        // 2. Özellik/içerik koruma - kullanıcı özelliğe erişim hakkına sahip mi?
        // Premium üyeliği olmayan kullanıcılar için pricing sayfasına yönlendir
        const hasAccess = await verifyPremiumAccess(auth, req);
        
        if (!hasAccess) {
          console.log('Premium access denied - subscription required');
          return NextResponse.redirect(new URL('/pricing?premium=required', req.url));
        }
      } catch (error) {
        console.error('Auth error:', error);
        return NextResponse.redirect(new URL('/login', req.url));
      }
    }
  }

  return NextResponse.next();
});

// Premium erişimi doğrula - bu Clerk'in auth nesnesi ile doğrudan erişim olmadan 
// premium kontrolü yapmak için basit bir yardımcı fonksiyon
async function verifyPremiumAccess(auth: any, req: any): Promise<boolean> {
  try {
    // Kullanıcının premium erişimi olup olmadığını kontrol ediyoruz
    // Not: Gerçek uygulamada bu kontrol için custom-permission yazılmalı
    // ve auth.protect() içinde kullanılmalı
    return await new Promise<boolean>((resolve) => {
      // Burada normalde auth.sessionClaims erişimi gibi
      // daha detaylı bir kontrol olacaktı
      // Şimdilik basit bir geçici çözüm sunuyoruz
      // Gerçek uygulamada bu daha etkili yapılmalı
      resolve(true); // Geliştirme aşamasında herkesi premium kabul et
    });
  } catch (error) {
    console.error('Premium verification error:', error);
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