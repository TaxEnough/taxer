import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Korumalı rotalar
const protectedRoutes = ['/dashboard', '/profile', '/transactions', '/reports'];
// Admin rotaları
const adminRoutes = ['/admin/blog'];
// Kimlik doğrulama gerektirmeyen rotalar
const authRoutes = ['/login', '/register'];
// Blog rotaları (herkese açık)
const publicBlogRoutes = ['/blog'];
// Cookie adı
const COOKIE_NAME = 'auth-token';

// Admin kullanıcılar
const ADMIN_EMAILS = [
  'info.taxenough@gmail.com',
  // Burada diğer admin e-posta adreslerini ekleyebilirsiniz
];

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
  
  // Admin rotalarına erişimi kontrol et
  if (adminRoutes.some(route => pathname.startsWith(route))) {
    if (!validToken) {
      console.log('Admin sayfasına erişim engellendi, login sayfasına yönlendiriliyor');
      const url = new URL('/login', request.url);
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }
    
    // Token varsa admin yetkisini kontrol et
    try {
      const decoded = verifyToken(validToken);
      if (!decoded || !decoded.email || !ADMIN_EMAILS.includes(decoded.email)) {
        console.log('Admin yetkisi yok, dashboard sayfasına yönlendiriliyor');
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch (error) {
      console.error('Token doğrulama hatası:', error);
      // Token geçersizse login sayfasına yönlendir
      const url = new URL('/login', request.url);
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }
    
    // Admin yetkisi varsa erişime izin ver
    return NextResponse.next();
  }
  
  // Korumalı bir sayfaya erişmeye çalışıyorsa ve token yoksa, giriş sayfasına yönlendir
  if (protectedRoutes.some(route => pathname.startsWith(route)) && !validToken) {
    console.log('Korumalı rota erişimi engellendi, login sayfasına yönlendiriliyor');
    const url = new URL('/login', request.url);
    
    // Yönlendirme sonrası dönülecek url'i ekle
    url.searchParams.set('returnUrl', pathname);
    
    return NextResponse.redirect(url);
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