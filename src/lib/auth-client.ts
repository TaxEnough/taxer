'use client';

import Cookie from 'js-cookie';
import { useUser } from '@clerk/nextjs';

// Client tarafında çerez işlemleri
const COOKIE_NAME = 'auth-token';

const AUTH_TOKEN_KEY = 'auth-token';
const COOKIE_OPTIONS = {
  secure: true,
  sameSite: 'lax' as const, // 'lax' is better for most cases, preventing CSRF while allowing normal navigation
  expires: 7 // days
};

export function getClientCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    console.log(`Cookie ${name} bulundu:`, cookieValue ? 'değer var' : 'değer yok');
    return cookieValue || null;
  }
  
  console.log(`Cookie ${name} bulunamadı`);
  return null;
}

export function setClientCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  
  const cookieValue = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  document.cookie = cookieValue;
  
  console.log(`Cookie ${name} ayarlandı:`, cookieValue);
}

export function removeClientCookie(name: string): void {
  if (typeof document === 'undefined') return;
  
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  console.log(`Cookie ${name} silindi`);
}

// Clerk'ten kullanıcı token'ı almayı dene ve Firebase uyumlu hale getir
export async function getAuthTokenFromClient(): Promise<string | null> {
  try {
    // Önce cookie'den token kontrol et
    const existingToken = Cookie.get('clerk-token');
    if (existingToken) {
      // Token alındı, debug için log
      console.log('Token cookie\'den alındı, uzunluk:', existingToken.length);
      
      // Firebase ve Clerk userId'sini senkronize et
      try {
        if (typeof window !== 'undefined') {
          // Kullanıcı ID'sini al
          const userId = localStorage.getItem('clerk-user-id');
          if (userId) {
            console.log('Kullanıcı ID\'si:', userId);
            // Kullanıcı ID'sini özel bir alanla Firebase uyumlu token'a ekle
            localStorage.setItem('firebase-user-id', userId);
            // Firebase uygulamasına kullanıcı ID'sini ayarla (opsiyonel)
          }
        }
      } catch (userIdError) {
        console.error('Kullanıcı ID işleme hatası:', userIdError);
      }
      
      return existingToken;
    }
    
    // Clerk tarayıcı tarafı API'siyle token almaya çalış
    if (typeof window !== 'undefined') {
      try {
        // @ts-ignore - Global Clerk nesnesini kullan
        const clerk = window.Clerk;
        if (clerk && clerk.session) {
          const token = await clerk.session.getToken();
          
          if (token) {
            // Token'ı kısa süreli cache'le (5 dakika)
            Cookie.set('clerk-token', token, { expires: 1/288 }); // 5 dakika = 1/288 gün
            
            // Kullanıcı ID'sini kaydet
            if (clerk.user?.id) {
              console.log('Clerk kullanıcı ID\'si alındı ve kaydedildi:', clerk.user.id);
              localStorage.setItem('clerk-user-id', clerk.user.id);
              localStorage.setItem('firebase-user-id', clerk.user.id);
            }
            
            return token;
          }
        }
      } catch (browserError) {
        console.error('Browser token error:', browserError);
      }
    }
    
    // Alternatif - localStorage'da kayıtlı token'ı kontrol et
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('auth-token');
      if (storedToken) {
        return storedToken;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

// Set token in client-side storage
export function setAuthTokenInClient(token: string): void {
  // Validate token format
  if (!isValidJWT(token)) {
    console.error('Attempting to store invalid token format');
    return;
  }
  
  // Set in both cookie and localStorage for redundancy
  Cookie.set(AUTH_TOKEN_KEY, token, COOKIE_OPTIONS);
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  
  // Set login status flag
  localStorage.setItem('isLoggedIn', 'true');
  
  console.log('Token saved in client storage');
}

// Helper function to validate JWT token format
function isValidJWT(token: string): boolean {
  if (!token) return false;
  
  // Simple format validation (3 parts separated by dots)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.error('JWT format invalid: wrong number of segments');
    return false;
  }
  
  // Check each part is base64url encoded
  try {
    // Decode header and payload (not signature)
    for (let i = 0; i < 2; i++) {
      const decodedPart = atob(parts[i].replace(/-/g, '+').replace(/_/g, '/'));
      // Try parsing as JSON
      JSON.parse(decodedPart);
    }
    return true;
  } catch (e) {
    console.error('JWT format invalid: decoding failed', e);
    return false;
  }
}

// Remove token from client-side storage
export function removeAuthTokenFromClient(): void {
  // Remove from both cookie and localStorage
  Cookie.remove(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  
  // Clear login status flag
  localStorage.setItem('isLoggedIn', 'false');
  
  // Clear user info
  localStorage.removeItem('user-info');
  
  console.log('Token removed from client storage');
}

// Client tarafında premium durumunu kontrol etmek için
export function getClientPremiumStatus(): { isPremium: boolean, plan?: string } {
  try {
    // 1. Clerk hook üzerinden kontrol et (React bileşenlerinde kullanılabilir)
    try {
      const { isSignedIn, user } = useUser();
      if (isSignedIn && user) {
        // @ts-ignore
        const subscription = user.publicMetadata?.subscription || user.privateMetadata?.subscription;
        if (subscription && subscription.status === 'active') {
          return { isPremium: true, plan: subscription.plan || 'premium' };
        }
      }
    } catch (hookError) {
      // Hook dışında kullanıldığında hata verebilir, devam et
    }
    
    // 2. Localstorage'da kayıtlı premium durumunu kontrol et
    if (typeof window !== 'undefined') {
      const premiumStatusStr = localStorage.getItem('clerk-premium-status');
      if (premiumStatusStr) {
        try {
          const premiumStatus = JSON.parse(premiumStatusStr);
          if (premiumStatus && premiumStatus.isPremium) {
            // Son kullanma süresi kontrolü
            const expiryStr = localStorage.getItem('clerk-premium-expiry');
            if (expiryStr) {
              const expiry = parseInt(expiryStr);
              if (!isNaN(expiry) && expiry > Date.now()) {
                return { isPremium: true, plan: premiumStatus.plan || 'premium' };
              }
            }
          }
        } catch (e) {
          console.error('Error parsing premium status:', e);
        }
      }
    }
    
    // 3. Cookie'den kontrol et
    const premiumCookie = Cookie.get('clerk-premium-status');
    if (premiumCookie) {
      try {
        const premiumData = JSON.parse(premiumCookie);
        if (premiumData && premiumData.isPremium) {
          return { isPremium: true, plan: premiumData.plan || 'premium' };
        }
      } catch (e) {
        console.error('Error parsing premium cookie:', e);
      }
    }
    
    return { isPremium: false };
  } catch (error) {
    console.error('Error checking premium status:', error);
    return { isPremium: false };
  }
} 