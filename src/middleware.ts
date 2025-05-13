import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAuthToken } from './lib/auth';

// Premium erişim gerektiren rotalar
const premiumRoutes = ['/transactions', '/dashboard', '/reports'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Premium rota kontrolü
  const isPremiumRoute = premiumRoutes.some(route => 
    pathname.startsWith(route) || pathname === route
  );
  
  if (!isPremiumRoute) {
    return NextResponse.next();
  }
  
  try {
    // Token kontrolü
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return redirectToLogin(request);
    }
    
    const decodedToken = await verifyAuthToken(token);
    
    if (!decodedToken || !decodedToken.uid) {
      return redirectToLogin(request);
    }
    
    // Premium durumu kontrolü
    const accountStatus = decodedToken.accountStatus;
    
    if (!accountStatus || accountStatus === 'free') {
      return redirectToPricing(request);
    }
    
    // Basic veya premium üyelik varsa devam et
    return NextResponse.next();
  } catch (error) {
    console.error('Premium route middleware error:', error);
    return redirectToLogin(request);
  }
}

// Giriş sayfasına yönlendirme
function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('from', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// Ücretlendirme sayfasına yönlendirme
function redirectToPricing(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/pricing';
  url.searchParams.set('from', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// Middleware'in çalışacağı rotalar 
export const config = {
  matcher: [
    '/transactions/:path*',
    '/dashboard/:path*',
    '/reports/:path*',
  ],
}; 