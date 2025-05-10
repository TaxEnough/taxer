'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserData } from '@/lib/auth-firebase';
import { getAuthTokenFromClient, setAuthTokenInClient, removeAuthTokenFromClient } from '@/lib/auth-client';

// Loglama seviyesini kontrol etmek için değişken
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

  // Loglama fonksiyonu
  const logInfo = (message: string, data?: any) => {
    if (DEBUG_LOGS) {
      if (data) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  };

  // Check cookies and get user info on client side
  useEffect(() => {
    logInfo('AuthProvider main useEffect running');
    let isMounted = true;
    
    // Aynı anda birden fazla auth check çalıştırmayı önle
    if (typeof window !== 'undefined' && window.__authCheckInProgress) {
      logInfo('Auth check already in progress, skipping');
      return;
    }
    
    const fetchUserData = async () => {
      // İşlem başladığında flag'i ayarla
      if (typeof window !== 'undefined') {
        window.__authCheckInProgress = true;
      }
      
      try {
        // İlk önce sessionStorage'dan veri yüklemeyi deneyelim
        // Bu, sayfa yenilemelerinde API çağrısına gerek kalmadan hızlı yükleme sağlar
        if (typeof window !== 'undefined') {
          const cachedUserInfo = sessionStorage.getItem('user-premium-info');
          const cacheExpiryStr = sessionStorage.getItem('premium-cache-expiry');
          const now = Date.now();
          const cacheExpiry = cacheExpiryStr ? parseInt(cacheExpiryStr) : 0;
          
          // Cache geçerli mi kontrol et (30 dakika = 1800000 ms)
          const isCacheValid = cachedUserInfo && cacheExpiry > now;
          
          if (isCacheValid) {
            logInfo('Using premium cache from sessionStorage, valid for', 
              Math.round((cacheExpiry - now) / 60000));
            try {
              const cachedUser = JSON.parse(cachedUserInfo);
              window.__userInfo = cachedUser;
              window.__isAuthenticated = true;
              window.__premiumCacheExpiry = cacheExpiry;
              
              if (isMounted && !user) {
                setUser(cachedUser);
                setLoading(false);
                window.__authCheckInProgress = false;
                return; // Session cache kullanıldı, API çağrısı yapmaya gerek yok
              }
            } catch (e) {
              console.error('Failed to parse user info from sessionStorage:', e);
            }
          } else if (cachedUserInfo) {
            logInfo('Premium cache expired, will refresh from API');
          }
        }
        
        // Check for tokens in multiple storage locations
        const token = getAuthTokenFromClient();
        const localStorageToken = localStorage.getItem('auth-token');
        const isLoggedInFlag = localStorage.getItem('isLoggedIn') === 'true';
        const userInfoStr = localStorage.getItem('user-info');
        
        logInfo('Auth check:', { 
          tokenExists: !!token, 
          lsTokenExists: !!localStorageToken,
          isLoggedIn: isLoggedInFlag
        });
        
        // Use any available token
        const effectiveToken = token || localStorageToken;
        
        // Consider user authenticated if any token exists or the flag is set
        const isAuthenticated = !!effectiveToken || isLoggedInFlag;
        
        // Set global authentication state
        if (typeof window !== 'undefined') {
          window.__isAuthenticated = isAuthenticated;
          
          // Check last token verification time to prevent too frequent API calls
          const now = Date.now();
          const lastCheck = window.__lastTokenCheck || 0;
          
          // API çağrılarını azalt: 5 dakika (300000 ms) bekle
          const shouldRefetch = (now - lastCheck) > 300000;
          
          logInfo('Global auth status:', window.__isAuthenticated ? 'logged in' : 'not logged in');
          logInfo('Time since last token check:', Math.floor((now - lastCheck) / 1000));
          
          // Try to use stored user info from localStorage if available
          if (userInfoStr && (!window.__userInfo || !user)) {
            try {
              const parsedUserInfo = JSON.parse(userInfoStr);
              window.__userInfo = parsedUserInfo;
              
              if (isMounted && !user) {
                logInfo('Restoring user from localStorage:', parsedUserInfo);
                setUser(parsedUserInfo);
                
                // Subscription bilgisini sessionStorage'a kaydet (30 dakika geçerli)
                if (parsedUserInfo.accountStatus) {
                  const expiry = now + 1800000; // 30 dakika
                  sessionStorage.setItem('user-premium-info', JSON.stringify(parsedUserInfo));
                  sessionStorage.setItem('premium-cache-expiry', expiry.toString());
                  window.__premiumCacheExpiry = expiry;
                  logInfo('Premium status cached in session for 30 minutes');
                }
                
                // If on protected page and not loading, stop here to prevent flicker
                if (protectedRoutes.some(route => pathname?.startsWith(route)) && !loading) {
                  setLoading(false);
                  window.__authCheckInProgress = false;
                  
                  // Only make API call in background if needed
                  if (shouldRefetch && effectiveToken) {
                    verifyWithApi(effectiveToken);
                  }
                  return;
                }
              }
            } catch (e) {
              console.error('Failed to parse user info from localStorage:', e);
            }
          }
          
          // Use cached user if available and no new check is needed
          if (window.__userInfo && !shouldRefetch && isAuthenticated) {
            logInfo('Using cached user information');
            if (isMounted) {
              setUser(window.__userInfo);
              setLoading(false);
              window.__authCheckInProgress = false;
              return;
            }
          }
          
          // Update last check time
          window.__lastTokenCheck = now;
        }
        
        if (effectiveToken) {
          // If token exists and enough time has passed, get user info from API
          logInfo('Token exists, verifying with API...');
          await verifyWithApi(effectiveToken);
        } else if (isLoggedInFlag && userInfoStr) {
          // Even without token, if localStorage says we're logged in and has user info
          // Keep the user logged in on protected pages to avoid disruption
          try {
            const parsedUserInfo = JSON.parse(userInfoStr);
            if (isMounted) {
              logInfo('No token but localStorage has user info, maintaining session');
              setUser(parsedUserInfo);
              
              // Subscription bilgisini sessionStorage'a kaydet (30 dakika geçerli)
              if (parsedUserInfo.accountStatus) {
                const now = Date.now();
                const expiry = now + 1800000; // 30 dakika
                sessionStorage.setItem('user-premium-info', JSON.stringify(parsedUserInfo));
                sessionStorage.setItem('premium-cache-expiry', expiry.toString());
                window.__premiumCacheExpiry = expiry;
                logInfo('Premium status cached in session without token for 30 minutes');
              }
              
              setLoading(false);
              window.__authCheckInProgress = false;
              return;
            }
          } catch (e) {
            console.error('Failed to parse user info from isLoggedIn flag:', e);
          }
        } else {
          // No token or local storage info means user is not logged in
          logInfo('No authentication data, user is not logged in');
          if (typeof window !== 'undefined') {
            window.__userInfo = null;
            // Session storage'daki premium bilgisini temizle
            sessionStorage.removeItem('user-premium-info');
            sessionStorage.removeItem('premium-cache-expiry');
          }
          if (isMounted) {
            setUser(null);
            localStorage.setItem('isLoggedIn', 'false');
            setLoading(false);
            window.__authCheckInProgress = false;
            
            // If we're on a protected page and no auth data, redirect to login page
            if (protectedRoutes.some(route => pathname?.startsWith(route))) {
              logInfo('On protected page with no auth data, redirecting to login page');
              router.push('/login');
            }
          }
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        if (isMounted) {
          setUser(null);
          setLoading(false);
          if (typeof window !== 'undefined') {
            window.__authCheckInProgress = false;
          }
        }
      }
    };
    
    // Separate API verification to avoid code duplication
    const verifyWithApi = async (token: string) => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Auth-Token': token
          },
          cache: 'no-store'
        });
        
        if (response.ok) {
          const data = await response.json();
          logInfo('User info received from API:', data);
          
          // Cache the request result in global variable
          const userInfo = {
            id: data.id,
            email: data.email,
            name: data.name || data.email.split('@')[0],
            accountStatus: (data.accountStatus || 'free') as 'free' | 'basic' | 'premium',
          };
          
          if (typeof window !== 'undefined') {
            window.__userInfo = userInfo;
            window.__isAuthenticated = true;
            window.__lastTokenCheck = Date.now();
            window.__authCheckInProgress = false;
            
            // Premium bilgisini sessionStorage'a kaydet (30 dakika geçerli)
            const now = Date.now();
            const expiry = now + 1800000; // 30 dakika
            sessionStorage.setItem('user-premium-info', JSON.stringify(userInfo));
            sessionStorage.setItem('premium-cache-expiry', expiry.toString());
            window.__premiumCacheExpiry = expiry;
            logInfo('Premium status cached in session for 30 minutes from API');
          }
          
          if (isMounted) {
            setUser(userInfo);
            
            // Update localStorage
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user-info', JSON.stringify(userInfo));
            
            // Ensure token is saved in all places
            setAuthTokenInClient(token);
            
            setLoading(false);
          }
        } else {
          console.warn('API verification failed:', response.status);
          
          // Use localStorage user info if available
          const userInfoStr = localStorage.getItem('user-info');
          
          // Even if API verification fails, don't immediately log out on protected pages
          // Trust localStorage if we have user info there
          if (userInfoStr && protectedRoutes.some(route => pathname?.startsWith(route))) {
            logInfo('Using local user info despite API verification failure');
            try {
              const fallbackUser = JSON.parse(userInfoStr);
              // Ensure account status is properly typed
              fallbackUser.accountStatus = (fallbackUser.accountStatus || 'free') as 'free' | 'basic' | 'premium';
              
              // Session cache'e kaydet
              if (typeof window !== 'undefined') {
                const now = Date.now();
                const expiry = now + 1800000; // 30 dakika
                sessionStorage.setItem('user-premium-info', JSON.stringify(fallbackUser));
                sessionStorage.setItem('premium-cache-expiry', expiry.toString());
                window.__premiumCacheExpiry = expiry;
                window.__authCheckInProgress = false;
                logInfo('Using fallback premium status in session for 30 minutes');
              }
              
              if (isMounted) {
                setUser(fallbackUser);
                setLoading(false);
              }
              return;
            } catch (e) {
              console.error('Failed to parse fallback user info:', e);
            }
          }
          
          // Clear tokens only if API explicitly rejects with 401 AND we're not on a protected page
          if (response.status === 401 && !protectedRoutes.some(route => pathname?.startsWith(route))) {
            logInfo('Token rejected by API, clearing auth state');
            removeAuthTokenFromClient();
            // Session storage'daki premium bilgisini temizle
            sessionStorage.removeItem('user-premium-info');
            sessionStorage.removeItem('premium-cache-expiry');
            
            if (typeof window !== 'undefined') {
              window.__userInfo = null;
              window.__isAuthenticated = false;
              window.__authCheckInProgress = false;
            }
            if (isMounted) {
              setUser(null);
              localStorage.setItem('isLoggedIn', 'false');
            }
          }
          
          if (isMounted) {
            setLoading(false);
            if (typeof window !== 'undefined') {
              window.__authCheckInProgress = false;
            }
          }
        }
      } catch (error) {
        console.error('Error verifying token with API:', error);
        // On network errors, keep the user logged in using localStorage info
        const userInfoStr = localStorage.getItem('user-info');
        if (userInfoStr && isMounted) {
          try {
            const fallbackUser = JSON.parse(userInfoStr);
            
            // Session cache'e kaydet - network hatası durumunda
            if (typeof window !== 'undefined' && fallbackUser.accountStatus) {
              const now = Date.now();
              const expiry = now + 1800000; // 30 dakika
              sessionStorage.setItem('user-premium-info', JSON.stringify(fallbackUser));
              sessionStorage.setItem('premium-cache-expiry', expiry.toString());
              window.__premiumCacheExpiry = expiry;
              window.__authCheckInProgress = false;
              logInfo('Using fallback premium status on network error');
            }
            
            setUser(fallbackUser);
          } catch (e) {
            console.error('Failed to parse fallback user info on network error:', e);
          }
        }
        
        if (isMounted) {
          setLoading(false);
          if (typeof window !== 'undefined') {
            window.__authCheckInProgress = false;
          }
        }
      }
    };
    
    fetchUserData();
    
    // Listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      logInfo('Firebase auth state changed:', firebaseUser?.email || 'no session');
      
      // If there's a Firebase session but no user in context, update user info
      if (firebaseUser && !user && isMounted) {
        logInfo('Firebase session exists but no context user, updating information');
        
        // Check for a token before getting user info from API
        const token = getAuthTokenFromClient();
        if (!token) {
          logInfo('No token found, creating from Firebase session');
          // Generate token here or set user info directly
          const userFromFirebase = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
            accountStatus: 'free' as 'free' | 'basic' | 'premium',
          };
          
          setUser(userFromFirebase);
          
          // Save user info to localStorage and sessionStorage
          localStorage.setItem('user-info', JSON.stringify(userFromFirebase));
          localStorage.setItem('isLoggedIn', 'true');
          
          // Premium bilgisini sessionStorage'a kaydet (30 dakika geçerli)
          if (typeof window !== 'undefined') {
            const now = Date.now();
            const expiry = now + 1800000; // 30 dakika
            sessionStorage.setItem('user-premium-info', JSON.stringify(userFromFirebase));
            sessionStorage.setItem('premium-cache-expiry', expiry.toString());
            window.__premiumCacheExpiry = expiry;
            window.__userInfo = userFromFirebase;
            window.__isAuthenticated = true;
            logInfo('Premium status cached from Firebase session');
          }
        }
      }
    });
    
    // Sayfa yüklendiğinde tek bir auth check yeterli, 
    // daha sonra navigasyon değişimlerinde check yapmak için ayrı bir listener
    const handleRouteChange = () => {
      // Route değiştiğinde işlem başlatılmadığından emin olalım
      if (typeof window !== 'undefined' && !window.__authCheckInProgress) {
        // Sadece navigasyon yenileme, UI'yi kilitlemiyoruz
        if (window.__userInfo) {
          // Zaten kullanıcı bilgisi var, API çağrısına gerek yok
          logInfo('Route changed, user info already available');
        } else {
          // Kullanıcı bilgisi yoksa hafif kontrol yap
          logInfo('Route changed, checking auth state');
          fetchUserData();
        }
      }
    };
    
    // pathname değişikliklerini izle
    if (pathname) {
      logInfo('Pathname changed:', pathname);
      handleRouteChange();
    }
    
    // Set up periodic auth check (less frequent API calls)
    const checkAuthInterval = setInterval(() => {
      if (typeof window !== 'undefined' && window.__isAuthenticated && !window.__authCheckInProgress) {
        const now = Date.now();
        const lastCheck = window.__lastTokenCheck || 0;
        
        // Eski 2 dakika yerine 5 dakikaya çıkarıldı (300 saniye)
        if ((now - lastCheck) > 300000) {
          logInfo('Refreshing auth state after timeout');
          fetchUserData();
        }
      }
    }, 60000); // Check every minute if refresh is needed
    
    // Cleanup on unmount
    return () => { 
      isMounted = false;
      clearInterval(checkAuthInterval);
      unsubscribe();
      // Temizlik yaparken flag'i sıfırla
      if (typeof window !== 'undefined') {
        window.__authCheckInProgress = false;
      }
    };
  }, [pathname, router, user]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Login failed');
      }

      const data = await response.json();
      logInfo('Login successful, user:', data.user);
      
      // Save token on client side
      if (data.token) {
        setAuthTokenInClient(data.token);
        localStorage.setItem('isLoggedIn', 'true');
        if (typeof window !== 'undefined') {
          window.__isAuthenticated = true;
          window.__userInfo = data.user;
          window.__lastTokenCheck = Date.now();
          
          // Premium bilgisini sessionStorage'a kaydet (30 dakika geçerli)
          const now = Date.now();
          const expiry = now + 1800000; // 30 dakika
          sessionStorage.setItem('user-premium-info', JSON.stringify(data.user));
          sessionStorage.setItem('premium-cache-expiry', expiry.toString());
          window.__premiumCacheExpiry = expiry;
          logInfo('Premium status cached on login');
        }
      }
      
      setUser(data.user);
      
      // Use page reload to solve redirection issue
      window.location.href = '/dashboard';
      return;
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
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Registration failed');
      }

      const data = await response.json();
      logInfo('Registration successful, user:', data.user);
      
      // Save token on client side
      if (data.token) {
        setAuthTokenInClient(data.token);
        localStorage.setItem('isLoggedIn', 'true');
        if (typeof window !== 'undefined') {
          window.__isAuthenticated = true;
          window.__userInfo = data.user;
          window.__lastTokenCheck = Date.now();
        }
      }
      
      setUser(data.user);
      
      // Use page reload to solve redirection issue
      window.location.href = '/dashboard';
      return;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      
      // Clear cookie on client side
      removeAuthTokenFromClient();
      localStorage.removeItem('isLoggedIn');
      
      // Session storage'daki premium bilgisini temizle
      if (typeof window !== 'undefined') {
        window.__isAuthenticated = false;
        window.__userInfo = null;
        sessionStorage.removeItem('user-premium-info');
        sessionStorage.removeItem('premium-cache-expiry');
      }
      
      setUser(null);
      
      // Use page reload to solve redirection issue
      window.location.href = '/login';
      return;
    } catch (error: any) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  // Kullanıcı bilgilerini güncelleme fonksiyonu
  const updateUserProfile = (updatedUser: User) => {
    setUser(updatedUser);
    if (typeof window !== 'undefined') {
      window.__userInfo = updatedUser;
      localStorage.setItem('user-info', JSON.stringify(updatedUser));
      
      // Premium bilgisini sessionStorage'da da güncelle
      const now = Date.now();
      const expiry = now + 1800000; // 30 dakika
      sessionStorage.setItem('user-premium-info', JSON.stringify(updatedUser));
      sessionStorage.setItem('premium-cache-expiry', expiry.toString());
      window.__premiumCacheExpiry = expiry;
      logInfo('Premium status updated in session cache');
    }
  };

  // Context.Provider'a value prop'u geçerken object olarak inline tanımla
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