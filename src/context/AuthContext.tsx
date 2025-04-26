'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUserData } from '@/lib/auth-firebase';
import { getAuthTokenFromClient, setAuthTokenInClient, removeAuthTokenFromClient } from '@/lib/auth-client';

interface User {
  id: string;
  email: string;
  name: string;
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
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check cookies and get user info on client side
  useEffect(() => {
    console.log('AuthProvider main useEffect running');
    let isMounted = true;
    
    const fetchUserData = async () => {
      try {
        // Check for tokens in multiple storage locations
        const token = getAuthTokenFromClient();
        const localStorageToken = localStorage.getItem('auth-token');
        const isLoggedInFlag = localStorage.getItem('isLoggedIn') === 'true';
        const userInfoStr = localStorage.getItem('user-info');
        
        console.log('Auth check:', { 
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
          
          // Make API call only if at least 30 seconds passed since last check
          const shouldRefetch = (now - lastCheck) > 30000;
          
          console.log('Global auth status:', window.__isAuthenticated ? 'logged in' : 'not logged in');
          console.log('Time since last token check:', Math.floor((now - lastCheck) / 1000), 'seconds');
          
          // Try to use stored user info from localStorage if available
          if (userInfoStr && (!window.__userInfo || !user)) {
            try {
              const parsedUserInfo = JSON.parse(userInfoStr);
              window.__userInfo = parsedUserInfo;
              
              if (isMounted && !user) {
                console.log('Restoring user from localStorage:', parsedUserInfo);
                setUser(parsedUserInfo);
                
                // If on protected page and not loading, stop here to prevent flicker
                if (protectedRoutes.some(route => pathname?.startsWith(route)) && !loading) {
                  setLoading(false);
                  
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
            console.log('Using cached user information');
            if (isMounted) {
              setUser(window.__userInfo);
              setLoading(false);
            }
            return;
          }
          
          // Update last check time
          window.__lastTokenCheck = now;
        }
        
        if (effectiveToken) {
          // If token exists and enough time has passed, get user info from API
          console.log('Token exists, verifying with API...');
          await verifyWithApi(effectiveToken);
        } else if (isLoggedInFlag && userInfoStr) {
          // Even without token, if localStorage says we're logged in and has user info
          // Keep the user logged in on protected pages to avoid disruption
          try {
            const parsedUserInfo = JSON.parse(userInfoStr);
            if (isMounted) {
              console.log('No token but localStorage has user info, maintaining session');
              setUser(parsedUserInfo);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error('Failed to parse user info from isLoggedIn flag:', e);
          }
        } else {
          // No token or local storage info means user is not logged in
          console.log('No authentication data, user is not logged in');
          if (typeof window !== 'undefined') {
            window.__userInfo = null;
          }
          if (isMounted) {
            setUser(null);
            localStorage.setItem('isLoggedIn', 'false');
            setLoading(false);
            
            // If we're on a protected page and no auth data, redirect to login page
            if (protectedRoutes.some(route => pathname?.startsWith(route))) {
              console.log('On protected page with no auth data, redirecting to login page');
              router.push('/login');
            }
          }
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        if (isMounted) {
          setUser(null);
          setLoading(false);
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
          console.log('User info received from API:', data);
          
          // Cache the request result in global variable
          const userInfo = {
            id: data.id,
            email: data.email,
            name: data.name || data.email.split('@')[0],
          };
          
          if (typeof window !== 'undefined') {
            window.__userInfo = userInfo;
            window.__isAuthenticated = true;
            window.__lastTokenCheck = Date.now();
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
            console.log('Using local user info despite API verification failure');
            try {
              const fallbackUser = JSON.parse(userInfoStr);
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
            console.log('Token rejected by API, clearing auth state');
            removeAuthTokenFromClient();
            if (typeof window !== 'undefined') {
              window.__userInfo = null;
              window.__isAuthenticated = false;
            }
            if (isMounted) {
              setUser(null);
              localStorage.setItem('isLoggedIn', 'false');
            }
          }
          
          if (isMounted) {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error verifying token with API:', error);
        // On network errors, keep the user logged in using localStorage info
        const userInfoStr = localStorage.getItem('user-info');
        if (userInfoStr && isMounted) {
          try {
            const fallbackUser = JSON.parse(userInfoStr);
            setUser(fallbackUser);
          } catch (e) {
            console.error('Failed to parse fallback user info on network error:', e);
          }
        }
        
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchUserData();
    
    // Listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('Firebase auth state changed:', firebaseUser?.email || 'no session');
      
      // If there's a Firebase session but no user in context, update user info
      if (firebaseUser && !user && isMounted) {
        console.log('Firebase session exists but no context user, updating information');
        
        // Check for a token before getting user info from API
        const token = getAuthTokenFromClient();
        if (!token) {
          console.log('No token found, creating from Firebase session');
          // Generate token here or set user info directly
          const userInfo = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
          };
          
          setUser(userInfo);
          
          // Save user info to localStorage
          localStorage.setItem('user-info', JSON.stringify(userInfo));
          localStorage.setItem('isLoggedIn', 'true');
          
          if (typeof window !== 'undefined') {
            window.__userInfo = userInfo;
            window.__isAuthenticated = true;
          }
        }
      }
    });
    
    // Set up periodic auth check (less frequent API calls)
    const checkAuthInterval = setInterval(() => {
      if (typeof window !== 'undefined' && window.__isAuthenticated) {
        console.log('Periodic auth check running');
        const now = Date.now();
        const lastCheck = window.__lastTokenCheck || 0;
        
        // Only check every 2 minutes (120 seconds)
        if ((now - lastCheck) > 120000) {
          console.log('Refreshing auth state');
          fetchUserData();
        }
      }
    }, 60000); // Check every minute if refresh is needed
    
    // Cleanup on unmount
    return () => { 
      isMounted = false;
      clearInterval(checkAuthInterval);
      unsubscribe();
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
      console.log('Login successful, user:', data.user);
      
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
      console.log('Registration successful, user:', data.user);
      
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
      if (typeof window !== 'undefined') {
        window.__isAuthenticated = false;
        window.__userInfo = null;
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