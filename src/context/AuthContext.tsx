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
  updateUser: (updatedUser: User) => void;
}

// Context'i React.Context tipinde tanımla
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  updateUser: () => {},
});

// Korumalı rotalar listesi
const protectedRoutes = ['/dashboard', '/profile', '/transactions', '/reports'];
// Kimlik doğrulama gerektirmeyen rotalar
const authRoutes = ['/login', '/register'];

// Global window tipi için interface tanımla
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

  // Client tarafında çerez kontrolü ve kullanıcı bilgilerini alma
  useEffect(() => {
    console.log('AuthProvider main useEffect running');
    let isMounted = true;
    
    const fetchUserData = async () => {
      try {
        // Client side token check
        const token = getAuthTokenFromClient();
        console.log('Client side token:', token ? 'exists' : 'none');
        
        // Check login status in localStorage with a global variable
        if (typeof window !== 'undefined') {
          window.__isAuthenticated = !!token;
          
          // Check last token verification time to prevent too frequent API calls
          const now = Date.now();
          const lastCheck = window.__lastTokenCheck || 0;
          
          // Make API call only if at least 10 seconds passed since last check
          const shouldRefetch = (now - lastCheck) > 10000;
          
          console.log('Global auth status:', window.__isAuthenticated ? 'logged in' : 'not logged in');
          console.log('Time since last token check:', Math.floor((now - lastCheck) / 1000), 'seconds');
          
          // Use cached user if available and no new check is needed
          if (window.__userInfo && !shouldRefetch && token) {
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
        
        if (token) {
          // If token exists and enough time has passed, get user info from API
          console.log('Token exists, getting user info from API');
          
          try {
            const response = await fetch('/api/auth/me', {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              // Prevent caching and make new request if at least 10 seconds passed
              cache: 'no-store'
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('User info received from API:', data);
              
              // Cache the request result in global variable
              if (typeof window !== 'undefined') {
                window.__userInfo = {
                  id: data.id,
                  email: data.email,
                  name: data.name || data.email.split('@')[0],
                };
              }
              
              if (isMounted) {
                setUser({
                  id: data.id,
                  email: data.email,
                  name: data.name || data.email.split('@')[0],
                });
                
                // Update localStorage when user info is received
                localStorage.setItem('isLoggedIn', 'true');
                
                // Check Firebase session
                const currentUser = auth.currentUser;
                if (!currentUser && data.email) {
                  console.log('No Firebase session but token exists, automatic login might be attempted');
                  // Note: We can't do automatic login here because password is required
                  // But we can inform the user that they need to login with Firebase
                }
              }
            } else {
              console.error('Could not get user info from API:', response.status);
              // Token might be invalid, clear it
              if (response.status === 401) {
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
            }
          } catch (error) {
            console.error('Error getting user info from API:', error);
          } finally {
            if (isMounted) {
              setLoading(false);
            }
          }
        } else {
          // No token means user is not logged in
          console.log('No token, user is not logged in');
          if (typeof window !== 'undefined') {
            window.__userInfo = null;
          }
          if (isMounted) {
            setUser(null);
            localStorage.setItem('isLoggedIn', 'false');
            setLoading(false);
            
            // If we're on a protected page and there's no token, redirect to login page
            if (protectedRoutes.some(route => pathname?.startsWith(route))) {
              console.log('On protected page with no token, redirecting to login page');
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
          console.log('No token but Firebase session exists, token needed for API request');
          // In this case, an API endpoint might be needed to create a token
          // For now, we just set basic user info
          const userData = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User'
          };
          
          if (typeof window !== 'undefined') {
            window.__userInfo = userData;
          }
          
          setUser(userData);
        }
      }
      
      // If there's no Firebase session but user in context, clear user info
      if (!firebaseUser && user && isMounted) {
        console.log('No Firebase session but context user exists, you can end the session');
        // We're not doing anything for now, user can call logout function
      }
    });
    
    // Check auth status at intervals, refresh only when needed
    const checkAuthInterval = setInterval(() => {
      const token = getAuthTokenFromClient();
      const isLoggedInFromStorage = localStorage.getItem('isLoggedIn') === 'true';
      
      // Update if token status doesn't match localStorage
      if ((!!token) !== isLoggedInFromStorage) {
        console.log('Auth status change detected, rechecking');
        fetchUserData();
      }
    }, 5000); // Check every 5 seconds (with API calls no more frequent than 10 seconds)
    
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
  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    if (typeof window !== 'undefined') {
      window.__userInfo = updatedUser;
    }
  };

  // Context.Provider'a value prop'u geçerken object olarak inline tanımla
  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 