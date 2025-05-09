import { compare, hash } from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
export const COOKIE_NAME = 'auth-token';

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

interface TokenPayload {
  userId: string;
  email?: string;
  name?: string;
  accountStatus?: 'free' | 'basic' | 'premium';
}

interface UserData {
  uid: string;
  email?: string | null;
  name?: string | null;
  accountStatus?: 'free' | 'basic' | 'premium';
}

// Token oluşturma fonksiyonu - kullanıcı bilgilerini ve abonelik durumunu içerir
export function generateToken(userIdOrData: string | UserData, email?: string, name?: string, accountStatus?: 'free' | 'basic' | 'premium'): string {
  let payload: TokenPayload;
  
  // Eğer ilk parametre bir nesne ise, ondan veri al
  if (typeof userIdOrData === 'object') {
    payload = {
      userId: userIdOrData.uid,
      email: userIdOrData.email || undefined,
      name: userIdOrData.name || undefined,
      accountStatus: userIdOrData.accountStatus || 'free'
    };
    console.log('Token oluşturuluyor (nesne):', { 
      userId: userIdOrData.uid, 
      accountStatus: payload.accountStatus 
    });
  } else {
    // String ID verildiğinde
    payload = { userId: userIdOrData };
    if (email) payload.email = email;
    if (name) payload.name = name;
    payload.accountStatus = accountStatus || 'free';
    console.log('Token oluşturuluyor (string):', { 
      userId: userIdOrData, 
      accountStatus: payload.accountStatus 
    });
  }
  
  // Token oluştur ve dön
  const token = sign(payload, JWT_SECRET, { expiresIn: '7d' });
  return token;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = verify(token, JWT_SECRET) as TokenPayload;
    console.log('Token doğrulandı:', {
      userId: decoded.userId,
      accountStatus: decoded.accountStatus || 'free'
    });
    return decoded;
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    return null;
  }
}

// Cookie ayarlama fonksiyonu
export function setAuthCookie(token: string, response: NextResponse): NextResponse {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: false, // Client tarafında erişilebilir olsun
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 gün
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    priority: 'high'
  });
  
  // Cache kontrolü için ek başlıklar
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

// Client tarafı işlemleri için auth-client.ts dosyasını kullanın
// Server tarafı işlemleri için auth-server.ts dosyasını kullanın 