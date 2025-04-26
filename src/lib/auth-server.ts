'use server';

import { compare, hash } from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from './firebase-admin';

// JWT için gerekli sabitleri tanımla (JWT_SECRET varsa)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const COOKIE_NAME = 'auth-token';

// Sabitleri dışa aktaran yardımcı fonksiyon
export async function getConstants() {
  return { JWT_SECRET, COOKIE_NAME };
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

export async function generateToken(userId: string): Promise<string> {
  return sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    return verify(token, JWT_SECRET) as { userId: string };
  } catch (error) {
    return null;
  }
}

// Server tarafı çerez işlemleri - sadece API rotalarında kullanılmalı
export async function setAuthCookieOnServer(token: string, response: NextResponse): Promise<NextResponse> {
  console.log('setAuthCookieOnServer çağrıldı, token:', token ? 'var' : 'yok');
  
  const cookieOptions = {
    name: COOKIE_NAME,
    value: token,
    httpOnly: false, // Client tarafında erişilebilir olması için false
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    sameSite: 'lax' as const,
    priority: 'high' as const
  };

  console.log('Response ile cookie ayarlanıyor');
  response.cookies.set(cookieOptions);
  
  // Cache kontrolü
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

export async function getAuthCookieFromRequest(request: Request): Promise<string | undefined> {
  console.log('getAuthCookieFromRequest çağrıldı');
  
  // Önce Authorization header kontrolü
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('Authorization header\'dan token bulundu');
    return token;
  }
  
  console.log('Request\'ten cookie alınıyor');
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    console.log('Cookie header bulunamadı');
    return undefined;
  }
  
  const cookieList = cookieHeader.split(';').map(cookie => cookie.trim());
  const authCookie = cookieList.find(cookie => cookie.startsWith(`${COOKIE_NAME}=`));
  
  if (!authCookie) {
    console.log(`${COOKIE_NAME} cookie bulunamadı`);
    return undefined;
  }
  
  const token = authCookie.split('=')[1];
  console.log('Cookie bulundu:', token ? 'var' : 'yok');
  return token;
}

export async function removeAuthCookieOnServer(): Promise<void> {
  console.log('removeAuthCookieOnServer çağrıldı');
  cookies().delete(COOKIE_NAME);
}

/**
 * Firebase kimlik doğrulama token'ını doğrular
 * 
 * @param token Firebase kimlik doğrulama token'ı
 * @returns Doğrulanmış token bilgisi veya null
 */
export async function verifyTokenServer(token: string) {
  try {
    // Firebase Auth token'ını doğrula
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    return null;
  }
} 