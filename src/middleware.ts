import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Korumalı rotalar
const protectedRoutes = ['/dashboard', '/profile', '/transactions', '/reports', '/admin/blog'];
// Paralı üyelik gerektiren rotalar
const paidMemberRoutes = ['/dashboard', '/transactions', '/reports'];
// Kimlik doğrulama gerektirmeyen rotalar
const authRoutes = ['/login', '/register'];
// Blog rotaları (herkese açık)
const publicBlogRoutes = ['/blog'];
// Cookie adı
const COOKIE_NAME = 'auth-token';

export function middleware(request: NextRequest) {
  // Log middleware'in hangi yol için çalıştığını
  console.log('Middleware çalıştırıldı:', request.nextUrl.pathname);
  
  // Alt alan adı (subdomain) kontrolü
  const host = request.headers.get('host') || '';
  const isBlogSubdomain = host.startsWith('blog.');
  
  // Eğer blog alt alan adından geliyorsa ve blog sayfalarına erişiyorsa, izin ver
  if (isBlogSubdomain) {
    console.log('Blog alt alan adından erişim:', request.nextUrl.pathname);
    
    // blog.siteadi.com/yazı-başlığı şeklindeki istekleri /blog/yazı-başlığı olarak yönlendir
    const url = new URL(`/blog${request.nextUrl.pathname}`, request.url);
    return NextResponse.rewrite(url);
  }
  
  // Cookie kontrolü - hem cookie doğrudan hem de Authorization header'dan kontrol et
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const authHeader = request.headers.get('Authorization');
  const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  
  // Geçerli token
  const validToken = token || headerToken;
  
  console.log('Cookie varlık kontrolü:', token ? 'var' : 'yok');
  console.log('Header token kontrolü:', headerToken ? 'var' : 'yok');
  
  const { pathname } = request.nextUrl;
  
  // Blog sayfalarına herkese açık erişim izni ver
  if (publicBlogRoutes.some(route => pathname.startsWith(route))) {
    console.log('Blog sayfasına erişim izni verildi');
    return NextResponse.next();
  }
  
  // Admin blog sayfalarına sadece giriş yapmış kullanıcılar erişebilir
  if (pathname.startsWith('/admin/blog') && !validToken) {
    console.log('Admin blog sayfasına erişim engellendi, login sayfasına yönlendiriliyor');
    const url = new URL('/login', request.url);
    url.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(url);
  }
  
  // Korumalı bir sayfaya erişmeye çalışıyorsa ve token yoksa, giriş sayfasına yönlendir
  if (protectedRoutes.some(route => pathname.startsWith(route)) && !validToken) {
    console.log('Korumalı rota erişimi engellendi, login sayfasına yönlendiriliyor');
    const url = new URL('/login', request.url);
    
    // Yönlendirme sonrası dönülecek url'i ekle
    url.searchParams.set('returnUrl', pathname);
    
    return NextResponse.redirect(url);
  }
  
  // Paralı üyelik gerektiren sayfalara erişimi kontrol et
  if (paidMemberRoutes.some(route => pathname.startsWith(route)) && validToken) {
    try {
      // Token'dan kullanıcı bilgisini al
      const decoded = verifyToken(validToken);
      
      if (!decoded || !decoded.userId) {
        console.log('Geçersiz token, login sayfasına yönlendiriliyor');
        const url = new URL('/login', request.url);
        url.searchParams.set('returnUrl', pathname);
        return NextResponse.redirect(url);
      }
      
      // Kullanıcının hesap durumunu kontrol et
      // Not: accountStatus bilgisi JWT token içinde olmayabilir,
      // gerçek bir uygulamada bunu veritabanından kontrol etmek gerekebilir
      const accountStatus = decoded.accountStatus || 'free';
      
      if (accountStatus === 'free') {
        console.log('Ücretsiz kullanıcı, premium içeriğe erişim engellendi');
        return NextResponse.redirect(new URL('/pricing', request.url));
      }
    } catch (error) {
      console.error('Token doğrulama hatası:', error);
      const url = new URL('/login', request.url);
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }
  }
  
  // Giriş ve kayıt sayfalarına erişmeye çalışıyorsa ve zaten token varsa, dashboard'a yönlendir
  if (authRoutes.some(route => pathname === route) && validToken) {
    console.log('Kullanıcı zaten giriş yapmış, dashboard sayfasına yönlendiriliyor');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // Diğer durumlarda normal erişime izin ver
  return NextResponse.next();
}

// Middleware'in çalışacağı rotaları belirt
export const config = {
  matcher: [
    /*
     * Aşağıdaki rotalar için middleware çalışacak:
     * - /dashboard, /profile, /transactions, /reports ve alt rotaları
     * - /login ve /register
     * - /blog ve alt rotaları
     * - /admin/blog ve alt rotaları
     */
    '/dashboard/:path*',
    '/profile/:path*',
    '/transactions/:path*',
    '/reports/:path*',
    '/login',
    '/register',
    '/blog/:path*',
    '/admin/blog/:path*',
  ],
}; 