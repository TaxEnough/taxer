'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useClerkAuthCache } from '@/lib/clerk-utils';
import { useUser, useSignIn, useClerk } from '@clerk/nextjs';

// Debug modunu belirle
const DEBUG_LOGS = process.env.NODE_ENV === 'development' && false; // Debug loglarını kapatmak için false

// User interface'ini Clerk'e uygun olarak tanımla
export interface User {
  id: string;
  name?: string;
  email?: string;
  imageUrl?: string;
  isLoaded: boolean;
  isPremium?: boolean;
  accountStatus?: 'free' | 'basic' | 'premium';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (updatedUser: User) => void;
}

// Define context with default values
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

// Provider component
export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  
  // Clerk hooks
  const { user: clerkUser, isLoaded: clerkIsLoaded, isSignedIn } = useUser();
  const { signIn } = useSignIn();
  const { signOut } = useClerk();
  
  // Clerk cache for quicker auth checks
  const clerkAuth = useClerkAuthCache();

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
  
  // Kullanıcı bilgilerini Clerk'ten AuthContext'e çevir
  const mapClerkUserToAuthUser = (clerkUser: any): User | null => {
    if (!clerkUser) return null;
    
    let accountStatus: 'free' | 'basic' | 'premium' = 'free';
    
    // Önce abonelik durumunu belirle
    if (clerkUser.publicMetadata?.subscription?.status === 'active') {
      accountStatus = clerkUser.publicMetadata?.subscription?.plan || 'premium';
    } else if (clerkUser.privateMetadata?.subscription?.status === 'active') {
      accountStatus = clerkUser.privateMetadata?.subscription?.plan || 'premium';
    }
    
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || 
            `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
      email: clerkUser.primaryEmailAddress?.emailAddress,
      imageUrl: clerkUser.imageUrl,
      isLoaded: true,
      isPremium: (clerkUser.publicMetadata?.subscription?.status === 'active') || 
                (clerkUser.privateMetadata?.subscription?.status === 'active'),
      accountStatus
    };
  };
  
  // Auth durumunu izle ve kullanıcıyı set et
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        
        // Clerk kullanıcısını kontrol et
        if (clerkIsLoaded) {
          if (isSignedIn && clerkUser) {
            const authUser = mapClerkUserToAuthUser(clerkUser);
            logInfo('AuthContext - Clerk auth: User logged in', authUser);
            setUser(authUser);
          } else {
            logInfo('AuthContext - Clerk auth: No user logged in');
            setUser(null);
          }
        }
        
        // Korumalı rota kontrolü
        checkProtectedRoute();
      } catch (error) {
        console.error('Auth check error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUser();
  }, [clerkIsLoaded, isSignedIn, clerkUser, pathname]);
  
  // Korumalı rotalar için yönlendirme kontrolü
  const checkProtectedRoute = () => {
    if (!pathname) return;
    
    // Kullanıcı henüz yüklenmediyse bekleme
    if (!clerkIsLoaded) return;
    
    // Korumalı sayfada ve oturum yoksa login sayfasına yönlendir
    const isProtectedRoute = protectedRoutes.some(route => 
      pathname.startsWith(route) || pathname === route
    );
    
    if (isProtectedRoute && !isSignedIn) {
      logInfo(`Redirecting to login, protected route: ${pathname}`);
      router.push('/login');
    }
    
    // Login/register sayfasında ve oturum varsa dashboard'a yönlendir  
    const isAuthRoute = authRoutes.some(route => 
      pathname.startsWith(route) || pathname === route
    );
    
    if (isAuthRoute && isSignedIn) {
      logInfo(`Redirecting to dashboard, already logged in: ${pathname}`);
      router.push('/dashboard');
    }
  };
  
  // Login handler (Clerk API ile)
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      if (!signIn) {
        throw new Error('Sign in function not available');
      }
      
      logInfo('Login attempt with:', { email });
      
      const response = await signIn.create({
        identifier: email,
        password
      });
      
      if (response.status === 'complete') {
        logInfo('Login successful');
        const authUser = mapClerkUserToAuthUser(clerkUser);
        setUser(authUser);
      } else {
        // İki faktörlü doğrulama veya diğer adımlar
        console.log('Additional steps required:', response);
        throw new Error('Additional verification steps required');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed';
      
      if (error.errors) {
        errorMessage = error.errors[0]?.message || 'Authentication failed';
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // Kaydolma handler (Clerk API ile)
  const register = async (name: string, email: string, password: string) => {
    try {
      setLoading(true);
      
      if (!signIn) {
        throw new Error('Sign in function not available');
      }
      
      // İsmi parçalara ayır
      const nameParts = name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      logInfo('Register attempt with:', { email, firstName, lastName });
      
      // Clerk ile kullanıcı oluştur
      const response = await fetch('/api/clerk/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName, 
          lastName,
          emailAddress: email,
          password
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }
      
      // Başarılı kayıttan sonra oturum aç
      logInfo('Registration successful, logging in');
      await login(email, password);
      
    } catch (error: any) {
      console.error('Registration error:', error);
      let errorMessage = 'Registration failed';
      
      if (error.errors) {
        errorMessage = error.errors[0]?.message || 'Registration failed';
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // Logout handler (Clerk API ile)
  const logout = async () => {
    try {
      setLoading(true);
      
      if (!signOut) {
        throw new Error('Sign out function not available');
      }
      
      logInfo('Logout initiated');
      await signOut();
      
      setUser(null);
      
      // Sayfa yenileme yerine router kullan
      logInfo('Logout successful, redirecting to homepage');
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  // User profilini güncelle
  const updateUserProfile = (updatedUser: User) => {
    if (!user) return;
    setUser({ ...user, ...updatedUser });
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