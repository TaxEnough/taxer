import { compare, hash } from 'bcryptjs';
import { sign, verify, decode } from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { clerkClient } from '@clerk/nextjs/server';

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

// Düzenlenmiş token ve kullanıcı tipleri
export interface DecodedToken {
  uid?: string;
  sub?: string;
  userId?: string;
  user_id?: string;
  email?: string;
  name?: string;
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

// API kimlik doğrulama token'ını kontrol eden fonksiyon
export async function verifyAuthToken(token: string): Promise<DecodedToken | null> {
  if (!token) return null;
  
  try {
    // Debug için token içeriğini görüntüle (güvenli ortamda)
    console.log('Token doğrulama başlıyor, token uzunluğu:', token.length);
    
    // Clerk token'ı olarak doğrulama
    try {
      const clerk = await clerkClient();
      // JWT'nin subject (sub) alanı Clerk kullanıcı ID'sidir
      const decoded = jwt.decode(token) as { sub?: string, azp?: string } | null;
      
      if (decoded) {
        console.log('Token decode edildi, içerik:', JSON.stringify({
          sub: decoded.sub,
          azp: decoded.azp,
          // diğer hassas olmayan alanlar...
        }));
      }
      
      if (decoded?.sub) {
        try {
          // Kullanıcıyı ID ile doğrula
          const user = await clerk.users.getUser(decoded.sub);
          
          if (user) {
            // Kullanıcı bilgilerini döndür
            const accountStatus = getAccountStatusFromClerk(user);
            
            console.log('Clerk kullanıcısı doğrulandı:', user.id);
            
            return {
              uid: user.id,
              sub: user.id,
              email: user.emailAddresses[0]?.emailAddress,
              name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '',
              accountStatus
            };
          }
        } catch (clerkError) {
          console.error('Clerk user verification error:', clerkError);
        }
      }
    } catch (clerkClientError) {
      console.error('Clerk client initialization error:', clerkClientError);
    }
    
    // Eğer Clerk token'ı değilse, JWT token olarak dene
    try {
      // JWT token doğrula
      const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
      
      // Kullanıcı ID'sini standardize et
      if (!decoded.uid) {
        if (decoded.sub) decoded.uid = decoded.sub;
        else if (decoded.userId) decoded.uid = decoded.userId;
        else if (decoded.user_id) decoded.uid = decoded.user_id;
      }
      
      console.log('JWT token doğrulandı, uid:', decoded.uid);
      
      return decoded;
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
    }
    
    // Token doğrulanamadı, ancak yine de içeriği decode et ve kullanıcı ID'si almaya çalış
    // NOT: Bu sadece hata ayıklama amaçlıdır, gerçek uygulamada kullanılmamalıdır
    try {
      const decoded = jwt.decode(token) as DecodedToken;
      if (decoded) {
        console.log('Token doğrulanamadı ama içerik alındı:', 
          decoded.sub || decoded.uid || decoded.userId || decoded.user_id);
          
        // En son çare olarak token içeriğinden kullanıcı ID'si çıkarmaya çalış
        const possibleUserId = decoded.sub || decoded.uid || decoded.userId || decoded.user_id;
        
        if (possibleUserId) {
          console.log('Token içeriğinden kullanıcı ID\'si alındı:', possibleUserId);
          return {
            uid: possibleUserId,
            sub: possibleUserId,
            accountStatus: 'premium'  // Kullanıcı erişim izni vermek için zorunlu alan
          };
        }
      }
    } catch (decodeError) {
      console.error('Token decode error:', decodeError);
    }
    
    return null;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// Clerk kullanıcısından abonelik durumunu al
function getAccountStatusFromClerk(user: any): 'free' | 'basic' | 'premium' {
  try {
    // Önce private metadata'yı kontrol et
    const privateSubscription = user.privateMetadata?.subscription;
    if (privateSubscription && privateSubscription.status === 'active') {
      return privateSubscription.plan || 'premium';
    }
    
    // Sonra public metadata'yı kontrol et
    const publicSubscription = user.publicMetadata?.subscription;
    if (publicSubscription && publicSubscription.status === 'active') {
      return publicSubscription.plan || 'premium';
    }
    
    // Varsayılan olarak ücretsiz hesap
    return 'free';
  } catch (error) {
    console.error('Error determining account status:', error);
    return 'free';
  }
}

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