'use client';

import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

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
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Sayfa yüklendiğinde kullanıcı oturumu ve yetkisi kontrol edilir
    if (!loading) {
      // Kullanıcı oturumu yoksa login sayfasına yönlendir
      if (!user) {
        router.push(`/login?from=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      
      // Kullanıcı accountStatus kontrolü (basic veya premium olmalı)
      if (user.accountStatus !== 'basic' && user.accountStatus !== 'premium') {
        // Fiyatlandırma sayfasına yönlendir ve hangi özellik için ücretlendirme gerektiğini belirt
        router.push(`${redirectPath}?from=${encodeURIComponent(window.location.pathname)}&feature=${featureName}`);
        return;
      }
    }
  }, [user, loading, router, redirectPath, featureName]);

  // Yükleme sırasında veya yetki kontrolü sırasında yükleme animasyonu göster
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
    </div>;
  }

  // Yetki yoksa, sayfa içeriği yüklenmeden önce durdur
  if (!user || (user.accountStatus !== 'basic' && user.accountStatus !== 'premium')) {
    return null;
  }

  // Erişim yetkisi varsa, çocuk bileşenleri göster
  return <>{children}</>;
} 