import { clerkMiddleware, getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getUserSubscriptionStatus } from "@/lib/subscription-utils";

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

// Premium içerik yolları
const premiumPaths = [
  "/transactions",
  "/reports",
  "/api/transactions",
  "/api/reports"
];

// Public veya premium kontrolü olmayan sayfalar
function isBasicPath(path: string): boolean {
  return (
    isPublicPath(path) ||
    path === "/dashboard" ||
    path === "/profile" ||
    path.startsWith("/settings") ||
    path.startsWith("/api/user")
  );
}

// Middleware, güvenlik ve izin kontrolü
export default function middleware(req: NextRequest) {
  // Manuel header ve cookie kontrolü yapalım
  const path = req.nextUrl.pathname;
  const cookies = req.headers.get('cookie') || '';
  const isPublic = isPublicPath(path);
  
  // Oturum durumunu çerezlerden kontrol edelim
  const hasClerkSessionCookies = 
    cookies.includes('__clerk_db_jwt=') || 
    cookies.includes('__session=') ||
    cookies.includes('__client');

  // Cookie bilgilerini logla (hassas bilgi yok)
  if (path.includes("/dashboard") || path.includes("/transactions") || path.includes("/reports")) {
    console.log(`[Auth Debug] Protected path: ${path}`);
    console.log(`[Auth Debug] Has cookies: ${cookies.length > 0}, Has clerk cookies: ${hasClerkSessionCookies}`);
  }
  
  // Ödeme API'leri için debug
  if (path.includes("/api/payment") || path.includes("/api/checkout")) {
    console.log(`[Auth Debug] API Path: ${path}, Public: true`);
  }
  
  // JWT token'ı içeren session cookie'si varsa, kullanıcıyı oturum açmış olarak değerlendir
  if (hasClerkSessionCookies) {
    // Login sayfasında ve cookie varsa yönlendir
    if (path.startsWith("/login") || path.startsWith("/register")) {
      console.log(`[Auth Redirect] Has auth cookies but trying to access ${path}, redirecting to dashboard`);
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    
    // Premium içerik kontrolü
    const isPremiumPath = premiumPaths.some(premiumPath => 
      path === premiumPath || path.startsWith(premiumPath + "/")
    );
    
    if (isPremiumPath) {
      try {
        // Abonelik durumunu çerezlerden kontrol edelim
        // __clerk_db_jwt içindeki JWT'yi decode edip kullanıcı meta verilerini kontrol etmemiz gerekiyor
        // Ancak bu kompleks olduğu için basit bir heuristic kullanacağız
        
        // Abonelik durum çerezini ara
        const subscriptionCookieMatch = cookies.match(/(?:subscription_status=([^;]+))/);
        const hasSubscription = subscriptionCookieMatch && subscriptionCookieMatch[1] === 'active';
        
        // Alternatif olarak isSubscribed=true veya premium=true gibi çerezler de kontrol et
        const hasActiveSubscription = 
          hasSubscription ||
          cookies.includes('isSubscribed=true') || 
          cookies.includes('premium=true') || 
          cookies.includes('isPremium=true');
        
        console.log(`[Premium Check] Path: ${path}, Has subscription indicators: ${hasActiveSubscription}`);
        
        // Geliştirme ortamında otomatik erişim verme - kullanıcının gerçekten premium olmasını kontrol et
        // if (process.env.NODE_ENV === 'development') {
        //   console.log('[Premium Check] Development environment, allowing access to premium content');
        //   return NextResponse.next();
        // }
        
        // Abonelik yoksa fiyatlandırma sayfasına yönlendir
        if (!hasActiveSubscription) {
          console.log(`[Premium Check] No active subscription, redirecting to pricing`);
          return NextResponse.redirect(new URL("/pricing?premium=required", req.url));
        }
      } catch (error) {
        console.error("[Premium Check Error]", error);
        // Hata durumunda güvenli tarafta kalarak erişime izin ver
        return NextResponse.next();
      }
    }
    
    // Korumalı ama premium olmayan sayfalar veya premium kullanıcıların erişimi
    return NextResponse.next();
  }
  
  // Korumalı yollara erişmeye çalışırken oturum açılmamışsa
  if (!isPublic) {
    console.log(`[Auth Redirect] Path: ${path} not public and no auth cookies, redirecting to login`);
    
    // Tarayıcıdan gelen istekler için güncellenmiş loglama
    if (req.headers.get('user-agent')?.includes('Mozilla')) {
      const requestInfo = {
        url: req.url,
        method: req.method,
        referer: req.headers.get('referer') || 'none'
      };
      console.log('[Auth Debug] Browser request details:', requestInfo);
    }
    
    // Login sayfasına yönlendir
    return NextResponse.redirect(new URL("/login", req.url));
  }
  
  // Diğer durumlarda normal akış devam etsin
  return NextResponse.next();
}

// Middleware matcher konfigürasyonu
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|public|assets).*)"],
}; 