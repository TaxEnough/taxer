import { clerkMiddleware, getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

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
    // Kullanıcının özel bir authentication header'ı ekleyelim
    // Bu, Clerk middleware'i öncesinde özel mantık uygulamak için
    const response = NextResponse.next();
    
    // Login sayfasında ve cookie varsa yönlendir
    if (path.startsWith("/login") || path.startsWith("/register")) {
      console.log(`[Auth Redirect] Has auth cookies but trying to access ${path}, redirecting to dashboard`);
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    
    return response;
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