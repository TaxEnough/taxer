'use client';

import { User } from '@clerk/nextjs/dist/types/server';
import { useUser } from '@clerk/nextjs';

// Cache süresi 30 dakika (saniye cinsinden)
const CACHE_DURATION = 1800;

/**
 * Clerk kullanıcısının premium durumunu kontrol eder
 * @param user Clerk kullanıcı nesnesi (any tipinde çünkü metadata alanları tiplendirilmemiş)
 * @returns Premium durumu nesnesi
 */
export function checkPremiumStatus(user: any): {
  isPremium: boolean;
  plan: string | null;
  status: string | null;
} {
  if (!user) {
    return { isPremium: false, plan: null, status: null };
  }

  // Private ve public metadata'dan subscription bilgilerini al
  const subscription = user.privateMetadata?.subscription || user.publicMetadata?.subscription;
  
  if (subscription && subscription.status === 'active') {
    return {
      isPremium: true,
      plan: subscription.plan || 'premium',
      status: subscription.status
    };
  }
  
  return { isPremium: false, plan: null, status: null };
}

/**
 * Clerk auth durumunun cookie'lere kaydedilmesi
 * Bu özellikle Edge fonksiyonlarında middleware'de kullanım için faydalı
 */
export function cacheUserAuthState(user: any, isSignedIn: boolean): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (isSignedIn && user) {
      // Kullanıcı oturum açmış durumda
      // 1. Premium durumunu kontrol et
      const premiumStatus = checkPremiumStatus(user);
      
      // 2. Kullanıcı temel bilgilerini ve premium durumunu cookie'ye kaydet
      document.cookie = `clerk-user-id=${user.id}; path=/; max-age=${CACHE_DURATION}; SameSite=Lax`;
      document.cookie = `clerk-auth-status=signed-in; path=/; max-age=${CACHE_DURATION}; SameSite=Lax`;
      
      // 3. Premium durumunu cookie'ye kaydet
      const premiumData = JSON.stringify({
        isPremium: premiumStatus.isPremium,
        plan: premiumStatus.plan,
        status: premiumStatus.status,
        timestamp: Date.now()
      });
      document.cookie = `clerk-premium-status=${premiumData}; path=/; max-age=${CACHE_DURATION}; SameSite=Lax`;
      
      // 4. LocalStorage'a da kaydet (client tarafı kullanım için)
      localStorage.setItem('clerk-user-id', user.id);
      localStorage.setItem('clerk-auth-status', 'signed-in');
      localStorage.setItem('clerk-premium-status', premiumData);
      localStorage.setItem('clerk-premium-expiry', (Date.now() + CACHE_DURATION * 1000).toString());
      
      console.log('User auth state cached for faster access');
    } else {
      // Kullanıcı oturum açmamış veya oturumu kapatmış
      // Cookie'leri temizle
      document.cookie = 'clerk-user-id=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'clerk-auth-status=signed-out; path=/; max-age=${CACHE_DURATION}; SameSite=Lax';
      document.cookie = 'clerk-premium-status=; path=/; max-age=0; SameSite=Lax';
      
      // LocalStorage'ı temizle
      localStorage.removeItem('clerk-user-id');
      localStorage.setItem('clerk-auth-status', 'signed-out');
      localStorage.removeItem('clerk-premium-status');
      localStorage.removeItem('clerk-premium-expiry');
      
      console.log('User auth state cleared from cache');
    }
  } catch (error) {
    console.error('Error caching user auth state:', error);
  }
}

/**
 * Clerk kullanıcı oturum durumunu ve premium bilgilerini hızlı erişim için izleyen özel hook
 * Bu hook, değişiklikleri izler ve cache'e kaydeder
 */
export function useClerkAuthCache() {
  const { isLoaded, isSignedIn, user } = useUser();
  
  // Clerk auth durumu yüklendiğinde, cache'leme işlemi yap
  if (isLoaded) {
    cacheUserAuthState(user, !!isSignedIn);
  }
  
  // Premium durumunu kontrol eden fonksiyon
  const checkPremium = (): boolean => {
    if (!isLoaded || !isSignedIn || !user) return false;
    
    return checkPremiumStatus(user as any).isPremium;
  };
  
  return { 
    isLoaded, 
    isSignedIn, 
    user,
    isPremium: checkPremium()
  };
}

/**
 * LocalStorage'dan hızlı bir şekilde premium durumunu kontrol eder
 * API çağrısı veya Clerk SDK'nın yüklenmesini beklemeden hızlı erişim sağlar
 */
export function getQuickPremiumStatus(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    // Cache süresini kontrol et
    const expiry = parseInt(localStorage.getItem('clerk-premium-expiry') || '0');
    const now = Date.now();
    
    // Cache geçerli mi?
    if (expiry > now) {
      const premiumData = localStorage.getItem('clerk-premium-status');
      if (premiumData) {
        const data = JSON.parse(premiumData);
        return data.isPremium || false;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking quick premium status:', error);
    return false;
  }
} 