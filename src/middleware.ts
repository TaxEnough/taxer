import { NextResponse } from 'next/server';
import { authMiddleware } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import type { AuthObject } from '@clerk/nextjs/server';

// Optimize edilmiş cookie işlemleri
function getCookieValue(request: NextRequest, name: string): string | null {
  const cookie = request.cookies.get(name);
  return cookie?.value || null;
}

// Premium içerik gerektiren rotalar
const premiumPaths = [
  '/transactions',
  '/reports',
];

// Clerk auth middleware
export default authMiddleware({
  // Herkese açık rotalar
  publicRoutes: [
    '/',
    '/login',
    '/register',
    '/pricing',
    '/about',
    '/contact',
    '/api/webhook/stripe', // Stripe webhook'u public olmalı
  ],
  
  // Korumalı rotalar için davranışı özelleştir
  afterAuth(auth, req) {
    // Kullanıcı oturum açmamışsa ve korumalı bir rotadaysa, login'e yönlendir
    if (!auth.userId && !auth.isPublicRoute) {
      return auth.redirectToSignIn({ returnBackUrl: req.url });
    }
    
    // Eğer kullanıcı giriş yapmışsa, auth bilgilerini cookie'lere kaydet (istemci tarafında kullanmak için)
    const response = NextResponse.next();
    
    // Premium rota kontrolü
    const path = req.nextUrl.pathname;
    const isPremiumRoute = premiumPaths.some(route => path.startsWith(route));
    
    if (isPremiumRoute) {
      // Öncelikle cookie'den premium durumunu kontrol et - daha hızlı
      const premiumStatusCookie = getCookieValue(req, 'clerk-premium-status');
      
      if (premiumStatusCookie) {
        try {
          const premiumData = JSON.parse(premiumStatusCookie);
          
          // Kullanıcının premium üyeliği var mı?
          if (premiumData.isPremium) {
            // Premium üyelik varsa devam et
            console.log('Premium access granted via cookie cache');
            return response;
          }
        } catch (error) {
          console.error('Error parsing premium status cookie:', error);
        }
      }
      
      // Kullanıcının abonelik bilgilerini al
      const userMeta = auth.user?.publicMetadata || {};
      const subscription = userMeta.subscription as any;
      
      // Premium erişimi kontrol et
      if (!subscription || subscription.status !== 'active') {
        // Premium üyelik yoksa 403 hatası döndür veya premium plana yönlendir
        console.log('Premium access denied - subscription required');
        return NextResponse.redirect(new URL('/pricing?premium=required', req.url));
      }
    }
    
    // Auth OK - devam et
    return response;
  },
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