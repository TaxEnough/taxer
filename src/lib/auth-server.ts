import { compare, hash } from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clerkClient } from '@clerk/nextjs/server';

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
 * Clerk kimlik doğrulama token'ını doğrular
 * 
 * @param token Clerk kimlik doğrulama token'ı
 * @returns Doğrulanmış token bilgisi veya null
 */
export async function verifyTokenServer(token: string) {
  if (!token || typeof token !== 'string') {
    console.error('Token geçersiz veya boş');
    return null;
  }

  // Token formatı kontrolü
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    console.error('Token yapısı geçersiz, beklenen format: header.payload.signature');
    return null;
  }

  console.log('Token doğrulama başlıyor, token uzunluğu:', token.length);

  try {
    // Clerk kullanıcısını doğrulama
    try {
      const clerk = await clerkClient();
      // JWT'nin subject (sub) alanı Clerk kullanıcı ID'sidir
      const decoded = verify(token, '', { algorithms: ['RS256'], complete: true }) as any;
      
      if (decoded?.payload?.sub) {
        try {
          // Kullanıcıyı ID ile doğrula
          const user = await clerk.users.getUser(decoded.payload.sub);
          
          if (user) {
            // Kullanıcı bilgilerini döndür
            return {
              uid: user.id,
              email: user.emailAddresses[0]?.emailAddress || '',
              name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '',
              accountStatus: getUserSubscriptionStatus(user)
            };
          }
        } catch (clerkError) {
          console.error('Clerk kullanıcı doğrulama hatası:', clerkError);
        }
      }
    } catch (clerkError) {
      console.error('Clerk token doğrulama hatası:', clerkError);
    }
    
    // Clerk doğrulaması başarısız olduysa kendi JWT'lerimizi doğrula
    try {
      // JWT doğrula
      const decoded = verify(token, JWT_SECRET) as { 
        userId: string, 
        email?: string, 
        name?: string, 
        accountStatus?: string,
        exp?: number
      };
      
      // Token içeriğini logla
      console.log('JWT token içeriği doğrulandı:', {
        userId: decoded.userId,
        accountStatus: decoded.accountStatus || 'free',
        expired: decoded.exp && decoded.exp * 1000 < Date.now()
      });
      
      // Eğer token süresi dolmuşsa yenile
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        console.log('Token süresi dolmuş, yenileniyor');
        
        // Yeni token oluştur
        const refreshedToken = sign({
          userId: decoded.userId,
          email: decoded.email || '',
          name: decoded.name || '',
          accountStatus: decoded.accountStatus || 'free'
        }, JWT_SECRET, { expiresIn: '7d' });
        
        // Yeni token payload
        return {
          uid: decoded.userId,
          email: decoded.email || '',
          name: decoded.name || '',
          accountStatus: decoded.accountStatus || 'free',
          isNewToken: true,
          refreshedToken: refreshedToken
        };
      }
      
      // Token geçerli
      return {
        uid: decoded.userId,
        email: decoded.email || '',
        name: decoded.name || '',
        accountStatus: decoded.accountStatus || 'free'
      };
    } catch (jwtError) {
      console.error('JWT ile yedek doğrulama başarısız:', jwtError);
      return null;
    }
  } catch (error) {
    console.error('Beklenmeyen token doğrulama hatası:', error);
    return null;
  }
}

// Clerk kullanıcısının abonelik durumunu belirle
function getUserSubscriptionStatus(user: any): 'free' | 'basic' | 'premium' {
  try {
    // Önce private metadata'yı kontrol et
    const privateSubscription = user.privateMetadata?.subscription;
    if (privateSubscription && privateSubscription.status === 'active') {
      return privateSubscription.plan === 'basic' ? 'basic' : 'premium';
    }
    
    // Sonra public metadata'yı kontrol et
    const publicSubscription = user.publicMetadata?.subscription;
    if (publicSubscription && publicSubscription.status === 'active') {
      return publicSubscription.plan === 'basic' ? 'basic' : 'premium';
    }
    
    return 'free';
  } catch (error) {
    console.error('Abonelik durumu belirlenirken hata oluştu:', error);
    return 'free';
  }
} 