'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuthTokenFromClient, setAuthTokenInClient, removeAuthTokenFromClient } from '@/lib/auth-client';

// DEBUG_LOGS değişkenini tamamen kapatıyoruz
const DEBUG_LOGS = false;

interface User {
  id: string;
  email: string;
  name: string;
  accountStatus: 'free' | 'basic' | 'premium';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (updatedUser: User) => void;
}

// Define context with React.Context type
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  updateUserProfile: () => {},
});

// Protected routes list
const protectedRoutes = ['/dashboard', '/profile', '/transactions', '/reports'];
// Routes that don't require authentication
const authRoutes = ['/login', '/register'];

// Define interface for global window type
declare global {
  interface Window {
    __isAuthenticated?: boolean;
    __lastTokenCheck?: number;
    __userInfo?: User | null;
    __premiumCacheExpiry?: number;
    __authCheckInProgress?: boolean;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Optimize loglama fonksiyonu
  const logInfo = DEBUG_LOGS 
    ? (message: string, data?: any) => {
        if (data) {
          console.log(message, data);
        } else {
          console.log(message);
        }
      } 
    : () => {};

  // Optimize edilmiş auth check - sadece gerektiğinde API çağrısı yapacak
  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;
    
    // Aynı anda birden fazla auth check çalıştırmayı önle
    if (typeof window !== 'undefined' && window.__authCheckInProgress) {
      return;
    }
    
    const fetchUserData = async () => {
      // İşlem başladığında flag'i ayarla
      if (typeof window !== 'undefined') {
        window.__authCheckInProgress = true;
      }
      
      try {
        // İlk önce sessionStorage'dan veri yüklemeyi deneyelim
        if (typeof window !== 'undefined') {
          const cachedUserInfo = sessionStorage.getItem('user-premium-info');
          const cacheExpiryStr = sessionStorage.getItem('premium-cache-expiry');
          const now = Date.now();
          const cacheExpiry = cacheExpiryStr ? parseInt(cacheExpiryStr) : 0;
          
          // Cache geçerli mi kontrol et
          if (cachedUserInfo && cacheExpiry > now) {
            try {
              const cachedUser = JSON.parse(cachedUserInfo);
              window.__userInfo = cachedUser;
              window.__isAuthenticated = true;
              window.__premiumCacheExpiry = cacheExpiry;
              
              if (isMounted && !user) {
                setUser(cachedUser);
                setLoading(false);
                window.__authCheckInProgress = false;
                return;
              }
            } catch (e) {
              console.error('Failed to parse user info from sessionStorage:', e);
            }
          }
        }
        
        // Token kontrolü - daha verimli hale getirildi
        const token = getAuthTokenFromClient();
        const isLoggedInFlag = localStorage.getItem('isLoggedIn') === 'true';
        
        // Kullanıcının oturum açmış olarak kabul edilmesi için token veya flag gerekli
        const isAuthenticated = !!token || isLoggedInFlag;
        
        // En son token doğrulama zamanını kontrol et - gereksiz API çağrılarını önlemek için
        let shouldRefetch = false;
        
        if (typeof window !== 'undefined') {
          window.__isAuthenticated = isAuthenticated;
          
          const now = Date.now();
          const lastCheck = window.__lastTokenCheck || 0;
          
          // API çağrılarını azalt: 10 dakika (600000 ms) bekle 
          shouldRefetch = (now - lastCheck) > 600000;
          
          // LocalStorage'dan kullanıcı bilgilerini kullanmayı dene
          const userInfoStr = localStorage.getItem('user-info');
          if (userInfoStr && !user) {
            try {
              const parsedUserInfo = JSON.parse(userInfoStr);
              window.__userInfo = parsedUserInfo;
              
              if (isMounted) {
                setUser(parsedUserInfo);
                
                // Premium bilgisini cache'le
                if (parsedUserInfo.accountStatus) {
                  const expiry = now + 1800000; // 30 dakika
                  sessionStorage.setItem('user-premium-info', JSON.stringify(parsedUserInfo));
                  sessionStorage.setItem('premium-cache-expiry', expiry.toString());
                  window.__premiumCacheExpiry = expiry;
                }
                
                // Korumalı sayfadaysak ve yükleme yapmıyorsak, burada durup ekranın yanıp sönmesini önleyelim
                if (protectedRoutes.some(route => pathname?.startsWith(route)) && !loading) {
                  setLoading(false);
                  window.__authCheckInProgress = false;
                  
                  // Sadece gerekirse ve token varsa arka planda API çağrısı yap
                  if (shouldRefetch && token) {
                    verifyWithApi(token);
                  }
                  return;
                }
              }
            } catch (e) {
              console.error('Failed to parse user info from localStorage:', e);
            }
          }
          
          // Hiç API çağrısı yapmadan sonucu dön - daha hızlı sayfa yükleme için
          if (window.__userInfo && !shouldRefetch && isAuthenticated) {
            if (isMounted) {
              setUser(window.__userInfo);
              setLoading(false);
              window.__authCheckInProgress = false;
              return;
            }
          }
        }
        
        // API çağrısı sadece aşağıdaki durumlarda yapılır:
        // 1. Token var
        // 2. Cache geçersiz
        // 3. Mevcut bir kullanıcı bilgisi yok
        if (token && (!window.__userInfo || shouldRefetch) && isAuthenticated) {
          await verifyWithApi(token);
        } else {
          // Token yoksa doğrulama başarısız oldu
          if (isMounted) {
            setUser(null);
            setLoading(false);
            
            // Korumalı bir rotadaysak ve token yoksa login'e yönlendir
            if (protectedRoutes.some(route => pathname?.startsWith(route))) {
              router.push('/login');
            }
          }
        }
      } catch (error) {
        console.error('Auth provider error:', error);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      } finally {
        if (typeof window !== 'undefined') {
          window.__authCheckInProgress = false;
        }
      }
    };
    
    // Optimize edilmiş token doğrulama fonksiyonu
    const verifyWithApi = async (token: string) => {
      try {
        // İstek iptal edilebilir olmalı
        abortController = new AbortController();
        
        // Timeout ile 10 saniyeden uzun süren istekleri iptal et
        const timeoutId = setTimeout(() => {
          if (abortController) {
            abortController.abort();
          }
        }, 10000);
        
        console.log('Verifying token with API');
        
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: abortController.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.user) {
            if (typeof window !== 'undefined') {
              window.__userInfo = data.user;
              window.__isAuthenticated = true;
              window.__lastTokenCheck = Date.now();
            }
            
            // Kullanıcı bilgilerini localStorage'a kaydet
            localStorage.setItem('user-info', JSON.stringify(data.user));
            localStorage.setItem('isLoggedIn', 'true');
            
            // Subscription bilgisini sessionStorage'a kaydet (30 dakika geçerli)
            if (data.user.accountStatus) {
              const now = Date.now();
              const expiry = now + 1800000; // 30 dakika
              sessionStorage.setItem('user-premium-info', JSON.stringify(data.user));
              sessionStorage.setItem('premium-cache-expiry', expiry.toString());
              
              if (typeof window !== 'undefined') {
                window.__premiumCacheExpiry = expiry;
              }
            }
            
            if (isMounted) {
              setUser(data.user);
              setLoading(false);
            }
          } else {
            throw new Error('No user data found');
          }
        } else {
          // Hata yanıtı
          const errorData = await response.json();
          console.error('Token verification API error:', errorData);
          
          // Token süresi dolmuşsa veya geçersizse
          if (response.status === 401) {
            // Token geçersiz - temizle ve yeniden yönlendir
            removeAuthTokenFromClient();
            localStorage.removeItem('user-info');
            localStorage.setItem('isLoggedIn', 'false');
            sessionStorage.removeItem('user-premium-info');
            sessionStorage.removeItem('premium-cache-expiry');
            
            if (typeof window !== 'undefined') {
              window.__userInfo = null;
              window.__isAuthenticated = false;
            }
            
            if (isMounted) {
              setUser(null);
              setLoading(false);
              
              // Korumalı bir rotadaysak ve token geçersizse login'e yönlendir
              if (protectedRoutes.some(route => pathname?.startsWith(route))) {
                router.push('/login');
              }
            }
          } else {
            // Geçici sunucu hatası - mevcut oturumu koruyabiliriz ama yalnızca
            // oturum verisi varsa
            if (localStorage.getItem('user-info')) {
              try {
                // Mevcut kullanıcı bilgisiyle devam et
                const userData = JSON.parse(localStorage.getItem('user-info') || '{}');
                
                if (isMounted) {
                  setUser(userData);
                  setLoading(false);
                }
              } catch (e) {
                if (isMounted) {
                  setUser(null);
                  setLoading(false);
                }
              }
            } else {
              if (isMounted) {
                setUser(null);
                setLoading(false);
              }
            }
          }
        }
      } catch (error: any) {
        console.error('API verification error:', error);
        
        // AbortError ile iptal edilmiş istek - mevcut bilgileri koruyabilir
        if (error?.name === 'AbortError') {
          console.warn('Token verification request timed out');
          
          if (localStorage.getItem('user-info') && isMounted) {
            try {
              const userData = JSON.parse(localStorage.getItem('user-info') || '{}');
              setUser(userData);
            } catch (e) {
              setUser(null);
            }
            setLoading(false);
            return;
          }
        }
        
        // Token doğrulama hatası - temizle ve yönlendir
        removeAuthTokenFromClient();
        localStorage.removeItem('user-info');
        localStorage.setItem('isLoggedIn', 'false');
        sessionStorage.removeItem('user-premium-info');
        sessionStorage.removeItem('premium-cache-expiry');
        
        if (typeof window !== 'undefined') {
          window.__userInfo = null;
          window.__isAuthenticated = false;
        }
        
        if (isMounted) {
          setUser(null);
          setLoading(false);
          
          // Korumalı bir rotadaysak ve hata oluştuysa login'e yönlendir
          if (protectedRoutes.some(route => pathname?.startsWith(route))) {
            router.push('/login');
          }
        }
      }
    };

    fetchUserData();
    
    return () => {
      isMounted = false;
      // İşlem devam ediyorsa iptal et
      if (abortController) {
        abortController.abort();
      }
    };
  }, [user, loading, router, pathname]);

  // Route değişikliklerini yönetmek için daha optimize edilmiş bir yaklaşım
  useEffect(() => {
    const handleRouteChange = () => {
      // Eğer pathname yoksa veya zaten kontrol ediliyorsa işlem yapmayalım
      if (!pathname || typeof window === 'undefined') return;
      
      const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
      const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));
      
      // Global auth durumuna bakalım
      const isAuthenticated = window.__isAuthenticated === true;
      
      // Korumalı bir sayfadayız ve kimlik doğrulama yapılmamış
      if (isProtectedRoute && !isAuthenticated && !loading) {
        router.push('/login');
        return;
      }
      
      // Login/register sayfasındayız ve zaten giriş yapılmış
      if (isAuthRoute && isAuthenticated && !loading) {
        router.push('/dashboard');
        return;
      }
    };
    
    handleRouteChange();
  }, [pathname, loading, router]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Login failed');
      }
      
      const data = await response.json();
      
      if (data.token) {
        // Token'ı client tarafında ayarla
        setAuthTokenInClient(data.token);
        
        // Kullanıcı bilgilerini kaydet
        localStorage.setItem('user-info', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');
        
        // Global durumu güncelle
        if (typeof window !== 'undefined') {
          window.__userInfo = data.user;
          window.__isAuthenticated = true;
          window.__lastTokenCheck = Date.now();
        }
        
        // State'i güncelle
        setUser(data.user);
        
        // Dashboard'a yönlendir
        router.push(data.redirectUrl || '/dashboard');
      } else {
        throw new Error('No token received');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Registration failed');
      }
      
      const data = await response.json();
      
      if (data.token) {
        // Token'ı client tarafında ayarla
        setAuthTokenInClient(data.token);
        
        // Kullanıcı bilgilerini kaydet
        localStorage.setItem('user-info', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');
        
        // Global durumu güncelle
        if (typeof window !== 'undefined') {
          window.__userInfo = data.user;
          window.__isAuthenticated = true;
          window.__lastTokenCheck = Date.now();
        }
        
        // State'i güncelle
        setUser(data.user);
        
        // Dashboard'a yönlendir
        router.push(data.redirectUrl || '/dashboard');
      } else {
        throw new Error('No token received');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Her durumda client tarafındaki token ve bilgileri temizle
      removeAuthTokenFromClient();
      localStorage.removeItem('user-info');
      localStorage.setItem('isLoggedIn', 'false');
      sessionStorage.removeItem('user-premium-info');
      sessionStorage.removeItem('premium-cache-expiry');
      
      // Global durumu güncelle
      if (typeof window !== 'undefined') {
        window.__userInfo = null;
        window.__isAuthenticated = false;
      }
      
      // State'i güncelle
      setUser(null);
      
      // Login sayfasına yönlendir
      router.push('/login');
    }
  };
  
  const updateUserProfile = (updatedUser: User) => {
    setUser(updatedUser);
    
    // LocalStorage'ı güncelle
    localStorage.setItem('user-info', JSON.stringify(updatedUser));
    
    // Global state'i güncelle
    if (typeof window !== 'undefined') {
      window.__userInfo = updatedUser;
    }
    
    // Subscription bilgisini sessionStorage'a güncelle
    if (updatedUser.accountStatus) {
      const now = Date.now();
      const expiry = now + 1800000; // 30 dakika
      sessionStorage.setItem('user-premium-info', JSON.stringify(updatedUser));
      sessionStorage.setItem('premium-cache-expiry', expiry.toString());
      
      if (typeof window !== 'undefined') {
        window.__premiumCacheExpiry = expiry;
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 