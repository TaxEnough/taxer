'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

interface PremiumGuardProps {
  children: ReactNode;
  redirectPath?: string;
  featureName?: string;
}

/**
 * Premium içerik erişim kontrolü için koruyucu bileşen.
 * Client tarafında hızlı bir kontrol sağlar.
 */
export default function PremiumGuard({ 
  children, 
  redirectPath = '/pricing', 
  featureName = 'premium content' 
}: PremiumGuardProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  // Cookie bazlı hızlı kontrol
  useEffect(() => {
    const checkBrowserAuth = () => {
      // Çerezlerden kontrol
      const hasCookieAuth = document.cookie.includes('__session=') || 
                            document.cookie.includes('__clerk_db_jwt=');
      
      // Client tarafında bir erken kontrol
      if (!hasCookieAuth) {
        router.push(`/login?from=${encodeURIComponent(window.location.pathname)}`);
        return false;
      }
      
      return true;
    };
    
    // Sadece browser tarafında çalıştır
    if (typeof window !== 'undefined') {
      const hasBasicAuth = checkBrowserAuth();
      if (!hasBasicAuth) {
        setIsChecking(false);
        return;
      }
    }
    
    // Clerk auth kontrolü
    if (isLoaded) {
      if (!isSignedIn) {
        router.push(`/login?from=${encodeURIComponent(window.location.pathname)}`);
        setIsChecking(false);
        return;
      }
      
      // Premium kontrolü (user as any ile type hatasını önlüyoruz)
      const userData = user as any;
      const hasSubscription = userData?.publicMetadata?.subscription?.status === 'active' || 
                              userData?.unsafeMetadata?.subscription?.status === 'active';
      
      setIsAuthorized(hasSubscription);
      setIsChecking(false);
      
      if (!hasSubscription) {
        router.push(`${redirectPath}?from=${encodeURIComponent(window.location.pathname)}&feature=${featureName}`);
      }
    }
  }, [isLoaded, isSignedIn, user, router, redirectPath, featureName]);

  // Kontrol edilirken yükleme göster
  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Yetkisi yoksa hiçbir şey gösterme
  if (!isAuthorized) {
    return null;
  }

  // Yetki kontrolü başarılı, içeriği göster
  return <>{children}</>;
} 