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
  return getClientCookie(COOKIE_NAME);
}

export function setAuthTokenInClient(token: string): void {
  console.log('Client tarafında auth token ayarlanıyor:', token ? 'token var' : 'token yok');
  setClientCookie(COOKIE_NAME, token, 7); // 7 gün
}

export function removeAuthTokenFromClient(): void {
  removeClientCookie(COOKIE_NAME);
} 