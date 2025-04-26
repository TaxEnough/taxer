'use client';

// Client tarafında çerez işlemleri
const COOKIE_NAME = 'auth-token';

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

// Auth token için özel fonksiyonlar
export function getAuthTokenFromClient(): string | null {
  if (typeof window === 'undefined') {
    console.warn('getAuthTokenFromClient server tarafında çağrılmaya çalışılıyor!');
    return null;
  }
  
  // Önce localStorage'a bak
  try {
    const lsToken = localStorage.getItem('auth-token');
    if (lsToken) {
      console.log('Token localStorage\'dan alındı');
      return lsToken;
    }
  } catch (e) {
    console.error('localStorage erişimi sırasında hata:', e);
  }
  
  // Sonra cookie'ye bak
  try {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith('auth-token=')) {
        const token = cookie.substring('auth-token='.length, cookie.length);
        console.log('Token cookie\'den alındı');
        return token;
      }
    }
  } catch (e) {
    console.error('Cookie okunurken hata:', e);
  }
  
  console.log('Token bulunamadı');
  return null;
}

export function setAuthTokenInClient(token: string): void {
  console.log('Client tarafında token ayarlanıyor');
  
  if (typeof window === 'undefined') {
    console.warn('setAuthTokenInClient server tarafında çağrılmaya çalışılıyor!');
    return;
  }
  
  // Cookie yönteminden önce localStorage kullanımı
  try {
    localStorage.setItem('auth-token', token);
    localStorage.setItem('isLoggedIn', 'true');
    console.log('Token localStorage\'a kaydedildi');
  } catch (e) {
    console.error('localStorage erişimi sırasında hata:', e);
  }

  // Cookie'yi manuel olarak ayarlayalım
  try {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 gün
    
    document.cookie = `auth-token=${token}; path=/; expires=${expiryDate.toUTCString()}; SameSite=Lax`;
    console.log('Token cookie olarak ayarlandı');
  } catch (e) {
    console.error('Cookie ayarlanırken hata:', e);
  }
  
  // Global state'i güncelle
  if (typeof window !== 'undefined') {
    window.__isAuthenticated = true;
    window.__lastTokenCheck = Date.now();
  }
}

export function removeAuthTokenFromClient(): void {
  console.log('Client tarafında token kaldırılıyor');
  
  if (typeof window === 'undefined') {
    console.warn('removeAuthTokenFromClient server tarafında çağrılmaya çalışılıyor!');
    return;
  }
  
  // localStorage'dan kaldır
  try {
    localStorage.removeItem('auth-token');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user-info');
    console.log('Token localStorage\'dan kaldırıldı');
  } catch (e) {
    console.error('localStorage erişimi sırasında hata:', e);
  }
  
  // Cookie'yi sil
  try {
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    console.log('Token cookie\'den kaldırıldı');
  } catch (e) {
    console.error('Cookie kaldırılırken hata:', e);
  }
  
  // Global state'i güncelle
  if (typeof window !== 'undefined') {
    window.__isAuthenticated = false;
    window.__userInfo = null;
    window.__lastTokenCheck = 0;
  }
} 