import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

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
  '/blog(.*)', // Blog sayfaları herkese açık
]);

// Admin rotalarını tanımla
const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
]);

// Admin kullanıcılar
const ADMIN_EMAILS = [
  'info.taxenough@gmail.com',
  // Burada diğer admin e-posta adreslerini ekleyebilirsiniz
];

// Clerk middleware ile kimlik doğrulamayı yönet
export default clerkMiddleware(async (auth, req) => {
  // Log middleware'in hangi yol için çalıştığını
  console.log('Middleware çalıştırıldı:', req.nextUrl.pathname);
  
  // Alt alan adı (subdomain) kontrolü
  const host = req.headers.get('host') || '';
  const isBlogSubdomain = host.startsWith('blog.');
  
  // Eğer blog alt alan adından geliyorsa ve blog sayfalarına erişiyorsa, izin ver
  if (isBlogSubdomain) {
    console.log('Blog alt alan adından erişim:', req.nextUrl.pathname);
    
    // blog.siteadi.com/yazı-başlığı şeklindeki istekleri /blog/yazı-başlığı olarak yönlendir
    const url = new URL(`/blog${req.nextUrl.pathname}`, req.url);
    return NextResponse.rewrite(url);
  }

  // Eğer geçerli URL public bir rota ise, devam et
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }
  
  // Admin rotalarına erişimi kontrol et
  if (isAdminRoute(req)) {
    try {
      // Kullanıcının oturum açıp açmadığını kontrol et
      await auth.protect();
      
      // Admin yetkisini kontrol etmek için gerekirse burada özel mantık ekleyebilirsiniz
      // Şimdilik sadece oturum açmış kullanıcıyı kontrol ediyoruz
      
      return NextResponse.next();
    } catch (error) {
      console.log('Admin sayfasına erişim engellendi, login sayfasına yönlendiriliyor');
      const url = new URL('/login', req.url);
      url.searchParams.set('returnUrl', req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  // Korumalı rotalar için kimlik doğrulama kontrolü
  if (isProtectedRoute(req)) {
    try {
      // auth.protect() kullanarak direkt yetkilendirme yapıyoruz
      // bu şekilde userId özelliğine erişim hatası almıyoruz
      await auth.protect();
      
      // Premium rota kontrolü
      const path = req.nextUrl.pathname;
      const isPremiumRoute = premiumPaths.some(route => path.startsWith(route));
      
      if (isPremiumRoute) {
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
      }
    } catch (error) {
      console.error('Auth error:', error);
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
});

// Premium erişimi doğrula
async function verifyPremiumAccess(auth: any, req: any): Promise<boolean> {
  try {
    // Kullanıcının premium erişimi olup olmadığını kontrol ediyoruz
    // Şu an geliştirme aşamasında olduğumuz için herkesin premium olduğunu varsayıyoruz
    return true;
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
    '/api/subscription/check-premium',
    '/api/transactions(.*)',
    '/dashboard/:path*',
    '/profile/:path*',
    '/transactions/:path*',
    '/reports/:path*',
    '/login',
    '/register',
    '/blog/:path*',
    '/admin/:path*',
  ],
}; 