import { clerkMiddleware, getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Liste yerine doğrudan kontroller kullanalım
function isPublicPath(path: string): boolean {
  return (
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/pricing") ||
    path.startsWith("/about") ||
    path.startsWith("/contact") ||
    path.startsWith("/api/webhook") ||
    path.startsWith("/api/payment") ||
    path.startsWith("/api/checkout") ||
    path.startsWith("/blog") ||
    path.startsWith("/api/blog")
  );
}

// Clerk middleware yapılandırması
export default clerkMiddleware((auth, req) => {
  try {
    // Detaylı auth bilgisi için ek bilgiler alalım
    // @ts-ignore - Clerk tipi güncellenmiş olabilir
    const { userId, sessionId, sessionClaims } = auth;
    
    // Signed in durumunu belirleme
    const isSignedIn = !!userId || !!sessionId;
    
    // Kapsamlı auth debug
    const authDebug = {
      userId: userId || 'none',
      sessionId: sessionId || 'none',
      hasSessionClaims: !!sessionClaims,
      isSignedIn: isSignedIn
    };
    
    const path = req.nextUrl.pathname;
    
    // Korumalı sayfalara erişim için auth detaylı debug
    if (path.includes("/dashboard") || path.includes("/transactions") || path.includes("/reports")) {
      console.log(`[Auth Debug] Protected path: ${path}`, authDebug);
      
      // Cookies bilgilerini loglayalım (hassas bilgiler olmadan)
      const cookies = req.headers.get('cookie') || 'no cookies';
      const hasCookies = cookies !== 'no cookies';
      console.log(`[Auth Debug] Has cookies: ${hasCookies}, Auth header: ${!!req.headers.get('authorization')}`);
    }
    
    // Ödeme API'leri için debug
    if (path.includes("/api/payment") || path.includes("/api/checkout")) {
      console.log(`[Auth Debug] API Path: ${path}, Public: true, SignedIn: ${isSignedIn}`);
    }
    
    // Public path kontrolü
    const isPublic = isPublicPath(path);
    
    // Kullanıcı oturum açmışsa ve login/register sayfalarına erişmeye çalışıyorsa
    if (isSignedIn && (path.startsWith("/login") || path.startsWith("/register"))) {
      console.log(`[Auth Redirect] User signed in (${userId}) trying to access ${path}, redirecting to dashboard`);
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    
    // Kullanıcı oturum açmamışsa ve korumalı sayfaya erişmeye çalışıyorsa
    if (!isPublic && !isSignedIn) {
      // Clerk oturum çerezleri için troubleshoot eki
      console.log(`[Auth Redirect] Path: ${path} not public and not signed in, redirecting to login`, authDebug);
      
      // Tarayıcıdan gelen istekler için tüm durumu daha net görelim
      if (req.headers.get('user-agent')?.includes('Mozilla')) {
        const requestInfo = {
          url: req.url,
          method: req.method,
          hasAuth: !!req.headers.get('authorization'),
          referer: req.headers.get('referer') || 'none'
        };
        console.log('[Auth Debug] Browser request details:', requestInfo);
      }
      
      return NextResponse.redirect(new URL("/login", req.url));
    }
    
    // Premium içerik kontrolü
    if ((path.startsWith("/transactions") || path.startsWith("/reports")) && isSignedIn) {
      // Geliştirme modunda erişime izin ver
      if (process.env.NODE_ENV === "development") {
        return NextResponse.next();
      }
      
      try {
        // @ts-ignore - Tipler değişmiş olabilir
        const privateMetadata = auth.sessionClaims?.privateMetadata || {};
        // @ts-ignore - Tipler değişmiş olabilir
        const publicMetadata = auth.sessionClaims?.publicMetadata || {};
        
        console.log('[Subscription Debug] Checking subscription:', {
          hasPrivateMeta: !!privateMetadata.subscription,
          hasPublicMeta: !!publicMetadata.subscription,
          privateStatus: privateMetadata.subscription?.status || 'none',
          publicStatus: publicMetadata.subscription?.status || 'none'
        });
        
        const hasActiveSubscription = 
          (privateMetadata.subscription?.status === "active") ||
          (publicMetadata.subscription?.status === "active");
        
        if (!hasActiveSubscription) {
          return NextResponse.redirect(new URL("/pricing?premium=required", req.url));
        }
      } catch (error) {
        console.error("Premium durum kontrolü hatası:", error);
        return NextResponse.redirect(new URL("/pricing?error=subscription_check", req.url));
      }
    }
    
    return NextResponse.next();
  } catch (error) {
    // Middleware hata yakalama
    console.error('[Middleware Error]', error);
    
    // Middleware'den kurtulmak için bir sonraki middleware'e geç
    return NextResponse.next();
  }
});

// Middleware matcher konfigürasyonu
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|public|assets).*)"],
}; 