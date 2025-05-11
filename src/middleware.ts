import { clerkMiddleware } from "@clerk/nextjs/server";
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
    path.startsWith("/blog") ||
    path.startsWith("/api/blog")
  );
}

// Clerk middleware yapılandırması
export default clerkMiddleware((auth, req) => {
  // @ts-ignore - Tipler değişmiş olabilir
  const isSignedIn = !!auth.userId || !!auth.sessionId; 
  const path = req.nextUrl.pathname;
  
  // Public path kontrolü
  const isPublic = isPublicPath(path);
  
  // Kullanıcı oturum açmışsa ve login/register sayfalarına erişmeye çalışıyorsa
  if (isSignedIn && (path.startsWith("/login") || path.startsWith("/register"))) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  
  // Kullanıcı oturum açmamışsa ve korumalı sayfaya erişmeye çalışıyorsa
  if (!isPublic && !isSignedIn) {
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
});

// Middleware matcher konfigürasyonu
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|public|assets).*)"],
}; 