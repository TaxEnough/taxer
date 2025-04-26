'use client';

import Cookie from 'js-cookie';

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

// Get token from client-side sources
export function getAuthTokenFromClient(): string | null {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Try to get from cookie first
  const cookieToken = Cookie.get(AUTH_TOKEN_KEY);
  
  // If not in cookie, try localStorage
  if (!cookieToken) {
    const localStorageToken = localStorage.getItem(AUTH_TOKEN_KEY);
    
    // If found in localStorage but not in cookie, restore cookie
    if (localStorageToken) {
      Cookie.set(AUTH_TOKEN_KEY, localStorageToken, COOKIE_OPTIONS);
      return localStorageToken;
    }
    
    return null;
  }
  
  // Cookie token exists but verify it matches localStorage
  const localStorageToken = localStorage.getItem(AUTH_TOKEN_KEY);
  
  // If tokens don't match, update localStorage
  if (localStorageToken !== cookieToken) {
    localStorage.setItem(AUTH_TOKEN_KEY, cookieToken);
  }
  
  return cookieToken;
}

// Set token in client-side storage
export function setAuthTokenInClient(token: string): void {
  // Set in both cookie and localStorage for redundancy
  Cookie.set(AUTH_TOKEN_KEY, token, COOKIE_OPTIONS);
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  
  // Set login status flag
  localStorage.setItem('isLoggedIn', 'true');
  
  console.log('Token saved in client storage');
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