import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Korumalı rotalar
const protectedRoutes = ['/dashboard', '/profile', '/transactions', '/reports'];
// Kimlik doğrulama gerektiren rotalar
const authRoutes = ['/login', '/register'];
// Cookie adı
const COOKIE_NAME = 'auth-token';

// Premium sayfalar listesi
const premiumRoutes = ['/dashboard', '/transactions', '/reports'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Eğer login veya register sayfasındaysa ve zaten token varsa, dashboard'a yönlendir
  if (authRoutes.some(route => pathname.startsWith(route))) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      const user = verifyToken(token);
      if (user && user.userId) {
        console.log('Zaten oturum açıldı, dashboard\'a yönlendiriliyor');
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // Eğer korumalı bir rotaya erişiliyorsa ve token yoksa, login'e yönlendir
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      console.log('Token yok, login\'e yönlendiriliyor');
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }
  
  // Premium sayfa kontrolü
  const isPremiumRoute = premiumRoutes.some(route => pathname.startsWith(route));
  
  // Eğer premium sayfa değilse devam et
  if (!isPremiumRoute) {
    return NextResponse.next();
  }

  // Token kontrolü
  const authToken = request.cookies.get(COOKIE_NAME)?.value;
  if (!authToken) {
    // Token yoksa login sayfasına yönlendir
    return redirectToLogin(request);
  }

  // Token doğrulama
  const payload = verifyToken(authToken);
  
  // Kullanıcı bilgilerini kontrol et
  if (!payload || !payload.userId) {
    return redirectToLogin(request);
  }
  
  // Abonelik durumunu kontrol et
  const accountStatus = payload.accountStatus;
  
  // Eğer accountStatus yoksa veya 'free' ise
  if (!accountStatus || accountStatus === 'free') {
    // Fiyatlandırma sayfasına yönlendir
    return redirectToPricing(request);
  }
  
  // Eğer 'basic' veya 'premium' ise devam et
  if (accountStatus === 'basic' || accountStatus === 'premium') {
    return NextResponse.next();
  }
  
  // Varsayılan olarak fiyatlandırma sayfasına yönlendir
  return redirectToPricing(request);
}

// Login sayfasına yönlendirme yardımcı fonksiyonu
function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

// Fiyatlandırma sayfasına yönlendirme yardımcı fonksiyonu
function redirectToPricing(request: NextRequest) {
  const pricingUrl = new URL('/pricing', request.url);
  return NextResponse.redirect(pricingUrl);
}

// Middleware'in çalışacağı route'ları belirleme
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|images|.*\\.png$).*)',
  ],
}; 