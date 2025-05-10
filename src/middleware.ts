import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Protected routes
const protectedRoutes = ['/dashboard', '/profile', '/transactions', '/reports'];
// Authentication routes
const authRoutes = ['/login', '/register'];
// Cookie name
const COOKIE_NAME = 'auth-token';

// Premium pages list
const premiumRoutes = ['/dashboard', '/transactions', '/reports'];

export function middleware(request: NextRequest) {
  // Geliştirme amacıyla konsola yazmak performansı etkiliyor
  // console.log('Middleware executing for path:', request.nextUrl.pathname);
  const { pathname } = request.nextUrl;

  // If on login or register page and token exists, redirect to dashboard
  if (authRoutes.some(route => pathname.startsWith(route))) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      const user = verifyToken(token);
      if (user && user.userId) {
        // console.log('Already logged in, redirecting to dashboard');
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // If accessing a protected route without token, redirect to login
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      // console.log('No token, redirecting to login');
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }
  
  // Premium page check
  const isPremiumRoute = premiumRoutes.some(route => pathname.startsWith(route));
  
  // If not a premium page, continue
  if (!isPremiumRoute) {
    // console.log('Not a premium route, continuing');
    return NextResponse.next();
  }

  // Token check - sadece premium sayfalarda token içeriğini kontrol ediyoruz
  const authToken = request.cookies.get(COOKIE_NAME)?.value;
  if (!authToken) {
    // If no token, redirect to login
    // console.log('No token for premium route, redirecting to login');
    return redirectToLogin(request);
  }

  // Verify token - payload içeriği kontrol edilir
  const payload = verifyToken(authToken);
  // console.log('Token payload:', payload);
  
  // Check user information
  if (!payload || !payload.userId) {
    // console.log('Invalid token payload, redirecting to login');
    return redirectToLogin(request);
  }
  
  // İsteğin client-side session storage'dan gelen premium durumunu kontrol et
  const premiumCookieName = 'user-premium-status';
  const premiumCookie = request.cookies.get(premiumCookieName)?.value;
  
  // Check subscription status - kullanıcının premium durumuna bakılır
  let accountStatus = payload.accountStatus;
  
  // Eğer token içinde account status yoksa ama cookie'de varsa, cookie değerini kullan
  if ((!accountStatus || accountStatus === 'free') && premiumCookie) {
    try {
      const premiumData = JSON.parse(premiumCookie);
      if (premiumData.accountStatus && 
          (premiumData.accountStatus === 'basic' || premiumData.accountStatus === 'premium')) {
        accountStatus = premiumData.accountStatus;
      }
    } catch (e) {
      // JSON parse hatası durumunda devam et
      console.error('Premium cookie parse error:', e);
    }
  }
  
  // If accountStatus doesn't exist or is 'free'
  if (!accountStatus || accountStatus === 'free') {
    // console.log('Free account attempting to access premium route:', pathname);
    // Hard redirect to 404 for free users
    return NextResponse.redirect(new URL('/404', request.url));
  }
  
  // If 'basic' or 'premium', continue
  if (accountStatus === 'basic' || accountStatus === 'premium') {
    // console.log('User has subscription, allowing access to premium route');
    return NextResponse.next();
  }
  
  // Default: redirect to 404
  // console.log('Default case - redirecting to 404');
  return NextResponse.redirect(new URL('/404', request.url));
}

// Helper function to redirect to login
function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

// Define routes where middleware should run - dar kapsamda çalıştıralım
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/transactions/:path*',
    '/reports/:path*',
    '/login',
    '/register'
  ],
}; 