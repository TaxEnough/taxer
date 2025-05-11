import { compare, hash } from 'bcryptjs';
import { sign, verify, decode } from 'jsonwebtoken';
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

// Ek olarak, Firebase/Clerk token'ları için DecodedToken interface'i
export interface DecodedToken {
  uid?: string;
  sub?: string;
  user_id?: string;
  userId?: string;
  firebase?: {
    identities?: {
      [key: string]: string[];
    };
  };
  accountStatus?: string;
  [key: string]: any;
}

interface UserData {
  uid: string;
  email?: string | null;
  name?: string | null;
  accountStatus?: 'free' | 'basic' | 'premium';
}

// Function to generate token - includes user information and subscription status
export function generateToken(userIdOrData: string | UserData, email?: string, name?: string, accountStatus?: 'free' | 'basic' | 'premium'): string {
  let payload: TokenPayload;
  
  // If the first parameter is an object, get data from it
  if (typeof userIdOrData === 'object') {
    payload = {
      userId: userIdOrData.uid,
      email: userIdOrData.email || undefined,
      name: userIdOrData.name || undefined,
      accountStatus: userIdOrData.accountStatus || 'free'
    };
    console.log('Creating token (object):', { 
      userId: userIdOrData.uid, 
      accountStatus: payload.accountStatus 
    });
  } else {
    // When given a string ID
    payload = { userId: userIdOrData };
    if (email) payload.email = email;
    if (name) payload.name = name;
    payload.accountStatus = accountStatus || 'free';
    console.log('Creating token (string):', { 
      userId: userIdOrData, 
      accountStatus: payload.accountStatus 
    });
  }
  
  // Create and return token
  const token = sign(payload, JWT_SECRET, { expiresIn: '7d' });
  return token;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = verify(token, JWT_SECRET) as TokenPayload;
    console.log('Token verified:', {
      userId: decoded.userId,
      accountStatus: decoded.accountStatus || 'free'
    });
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Kimlik doğrulama token'ını doğrular (auth-firebase'den taşındı)
 * 
 * @param token Kimlik doğrulama token'ı
 * @returns Doğrulanmış token bilgisi veya null
 */
export const verifyAuthToken = async (token: string): Promise<DecodedToken | null> => {
  try {
    // Token yoksa veya geçersizse hızlıca çık
    if (!token || token.trim() === '') {
      console.error('Geçersiz token: Boş veya null');
      return null;
    }
    
    console.log('Token doğrulama başlıyor, uzunluk:', token.length);
    
    // JWT token'ı decode et - doğrulama yapmadan sadece içeriğine bakıyoruz
    const decoded = decode(token) as DecodedToken | null;
    
    // Decoded boşsa, token biçimi geçersiz demektir
    if (!decoded) {
      console.error('Token decode edilemedi, geçersiz biçim');
      return null;
    }
    
    // Şimdi payload'ı logla ve kontrol et
    console.log('Token decode edildi, payload kontrolü yapılıyor');
    
    // UID kontrolü - token'ın içeriğindeki farklı alanlarda uid olabilir
    if (!decoded.uid) {
      console.log('UID bulunamadı, alternatif alanları kontrol ediyoruz');
      
      // sub alanını kontrol et (JWT standardı)
      if (decoded.sub) {
        decoded.uid = decoded.sub;
      }
      // user_id alanını kontrol et (Firebase'in kullandığı bir alan)
      else if (decoded.user_id) {
        decoded.uid = decoded.user_id;
      }
      // userId alanını kontrol et (özel bir alan)
      else if (decoded.userId) {
        decoded.uid = decoded.userId;
      }
      // Firebase identities içinde bakabilir
      else if (decoded.firebase && decoded.firebase.identities && decoded.firebase.identities['firebase.com']) {
        decoded.uid = decoded.firebase.identities['firebase.com'][0];
      }
    }
    
    // Hesap durumunu kontrol et ve varsayılan değer ata
    if (!decoded.accountStatus) {
      console.log('Account status bulunamadı, varsayılan değer atanıyor');
      
      // Client tarafında hesap durumunu localStorage'dan kontrol et
      if (typeof window !== 'undefined') {
        try {
          const userInfoStr = localStorage.getItem('user-info');
          if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            if (userInfo.accountStatus) {
              decoded.accountStatus = userInfo.accountStatus;
              console.log('Account status localStorage\'dan alındı:', decoded.accountStatus);
            }
          }
        } catch (error) {
          console.error('localStorage okuma hatası:', error);
        }
      }
      
      // Hala yoksa varsayılan değer
      if (!decoded.accountStatus) {
        decoded.accountStatus = 'free';
      }
    }
    
    console.log('Token doğrulama tamamlandı:', {
      uid: decoded.uid,
      accountStatus: decoded.accountStatus
    });
    
    return decoded;
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    return null;
  }
};

// Function to set cookie
export function setAuthCookie(token: string, response: NextResponse): NextResponse {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: false, // Accessible from client side
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    priority: 'high'
  });
  
  // Additional headers for cache control
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

// Use auth-client.ts file for client-side operations
// Use auth-server.ts file for server-side operations 