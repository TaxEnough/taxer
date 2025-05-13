'use client';

import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

interface PremiumGuardProps {
  children: ReactNode;
  redirectPath?: string;
  featureName?: string;
}

/**
 * Premium içerik erişim kontrolü için koruyucu bileşen.
 * Sadece 'basic' veya 'premium' üyeliği olan kullanıcıların
 * içeriği görmesine izin verir, diğerleri yönlendirilir.
 */
export default function PremiumGuard({ 
  children, 
  redirectPath = '/pricing', 
  featureName = 'premium content' 
}: PremiumGuardProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  // Kullanıcının premium üyeliği var mı kontrol et
  const hasPremiumSubscription = () => {
    if (!isLoaded || !isSignedIn || !user) return false;
    
    // TypeScript için user as any kullanarak metadata erişimi
    const userData = user as any;
    
    // Clerk metadata'dan subscription bilgisini kontrol et
    const userSubscription = userData.publicMetadata?.subscription || userData.unsafeMetadata?.subscription;
    
    // Aktif abonelik varsa true döndür
    return userSubscription && userSubscription.status === 'active';
  };

  useEffect(() => {
    // Sayfa yüklendiğinde kullanıcı oturumu ve yetkisi kontrol edilir
    if (isLoaded) {
      // Kullanıcı oturumu yoksa login sayfasına yönlendir
      if (!isSignedIn) {
        router.push(`/login?from=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      
      // Premium durumu kontrolü
      if (!hasPremiumSubscription()) {
        // Fiyatlandırma sayfasına yönlendir ve hangi özellik için ücretlendirme gerektiğini belirt
        router.push(`${redirectPath}?from=${encodeURIComponent(window.location.pathname)}&feature=${featureName}`);
        return;
      }
    }
  }, [isLoaded, isSignedIn, user, router, redirectPath, featureName]);

  // Yükleme sırasında veya yetki kontrolü sırasında yükleme animasyonu göster
  if (!isLoaded || !isSignedIn) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
    </div>;
  }

  // Premium üyelik yoksa içerik gösterme
  if (!hasPremiumSubscription()) {
    return null;
  }

  // Erişim yetkisi varsa, çocuk bileşenleri göster
  return <>{children}</>;
} 