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
  const { pathname } = request.nextUrl;

  // If on login or register page and token exists, redirect to dashboard
  if (authRoutes.some(route => pathname.startsWith(route))) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      const user = verifyToken(token);
      if (user && user.userId) {
        console.log('Already logged in, redirecting to dashboard');
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // If accessing a protected route without token, redirect to login
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      console.log('No token, redirecting to login');
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }
  
  // Premium page check
  const isPremiumRoute = premiumRoutes.some(route => pathname.startsWith(route));
  
  // If not a premium page, continue
  if (!isPremiumRoute) {
    return NextResponse.next();
  }

  // Token check
  const authToken = request.cookies.get(COOKIE_NAME)?.value;
  if (!authToken) {
    // If no token, redirect to login
    return redirectToLogin(request);
  }

  // Verify token
  const payload = verifyToken(authToken);
  
  // Check user information
  if (!payload || !payload.userId) {
    return redirectToLogin(request);
  }
  
  // Check subscription status
  const accountStatus = payload.accountStatus;
  
  // If accountStatus doesn't exist or is 'free'
  if (!accountStatus || accountStatus === 'free') {
    console.log('Free account attempting to access premium route, redirecting to 404');
    // Redirect to 404 page for free users trying to access premium content
    return NextResponse.rewrite(new URL('/404', request.url));
  }
  
  // If 'basic' or 'premium', continue
  if (accountStatus === 'basic' || accountStatus === 'premium') {
    return NextResponse.next();
  }
  
  // Default: redirect to 404
  return NextResponse.rewrite(new URL('/404', request.url));
}

// Helper function to redirect to login
function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

// Define routes where middleware should run
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/transactions/:path*',
    '/reports/:path*',
    '/login',
    '/register'
  ],
}; 