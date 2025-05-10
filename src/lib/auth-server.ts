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
  
  // Vercel'de çalışması için cookie ayarları
  const cookieOptions = {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,             // HttpOnly, güvenlik için
    path: '/',                  // Tüm path'lerde geçerli
    secure: true,               // HTTPS üzerinde çalışması için
    maxAge: 60 * 60 * 24 * 7,   // 1 hafta
    sameSite: 'none' as const,  // Cross-site istekleri için
    priority: 'high' as const
  };

  console.log('Response ile cookie ayarlanıyor:', cookieOptions);
  
  try {
    // Next.js Cookies API ile cookie ayarla
    response.cookies.set(cookieOptions);
    
    // Response header'larında token gönder (yedek yöntem)
    response.headers.set('X-Auth-Token', token);
    
    // Cache kontrolü
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Cookie ayarlanırken hata:', error);
    return response;
  }
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
  
  // X-Auth-Token header kontrolü (yedek yöntem)
  const xAuthToken = request.headers.get('X-Auth-Token');
  if (xAuthToken) {
    console.log('X-Auth-Token header\'dan token bulundu');
    return xAuthToken;
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
    // Check if token has the Firebase format
    if (!token || token.split('.').length !== 3) {
      console.error('Token format invalid');
      return null;
    }

    try {
      // Try with Firebase Admin SDK first
      const decodedToken = await auth.verifyIdToken(token);
      console.log('Token successfully verified with Firebase Admin');
      return decodedToken;
    } catch (firebaseError: any) {
      console.error('Firebase token verification error:', firebaseError?.message || firebaseError);
      
      // If the error is about missing kid claim, try verifying with JWT
      if (firebaseError?.message?.includes('kid') || 
          firebaseError?.code === 'auth/argument-error') {
        try {
          // Fallback to local JWT verification using our secret
          // İlk olarak süre kontrolünü devre dışı bırakarak deneyelim (ignoreExpiration: true)
          try {
            const decoded = verify(token, JWT_SECRET, { ignoreExpiration: true }) as { 
              userId: string, 
              email?: string, 
              name?: string, 
              accountStatus?: string,
              exp?: number
            };
            
            // Eğer token gerçekten süresi dolmuşsa, yeni bir token oluştur
            // Bu, süresi dolmuş JWT token'larını yenilememizi sağlar
            if (decoded.exp && decoded.exp * 1000 < Date.now()) {
              console.log('Token expired, refreshing with new expiration date');
              
              // Yeni bir JWT token oluştur, eski payload'ı koru
              const refreshedToken = sign({
                userId: decoded.userId,
                email: decoded.email || '',
                name: decoded.name || '',
                accountStatus: decoded.accountStatus || 'free'
              }, JWT_SECRET, { expiresIn: '7d' });
              
              // Yeni token'ı verify et
              const refreshedDecoded = verify(refreshedToken, JWT_SECRET) as { 
                userId: string, 
                email?: string, 
                name?: string, 
                accountStatus?: string 
              };
              
              // Firebase formatına dönüştür
              return {
                uid: refreshedDecoded.userId,
                email: refreshedDecoded.email || '',
                name: refreshedDecoded.name || '',
                accountStatus: refreshedDecoded.accountStatus || 'free',
                isNewToken: true,  // İstemciye yeni token oluşturulduğunu bildir
                refreshedToken: refreshedToken  // Yeni token'ı istemciye gönder
              };
            }
            
            // Token süresi geçerli, normal doğrulama
            // Convert to Firebase Admin format
            return {
              uid: decoded.userId,
              email: decoded.email || '',
              name: decoded.name || '',
              accountStatus: decoded.accountStatus || 'free',
            };
          } catch (expiredError) {
            // Süre kontrolünü devre dışı bırakma da başarısız olursa, daha derin bir sorun var
            console.error('JWT token refresh failed:', expiredError);
            return null;
          }
        } catch (jwtError) {
          console.error('JWT verification fallback error:', jwtError);
          return null;
        }
      }
      
      return null;
    }
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    return null;
  }
} 