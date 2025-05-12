"use client";

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';

/**
 * Premium durum senkronizasyonu için client component
 * Oturum yenilenmesinde premium durumunu kontrol eder ve çerezleri senkronize eder
 */
export default function PremiumSync() {
  const { isLoaded, userId } = useAuth();
  
  useEffect(() => {
    // Clerk oturumu yüklendiğinde premium durumunu kontrol et ve senkronize et
    if (isLoaded && userId) {
      fetch('/api/subscription/check-premium', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(response => {
        console.log('Premium durum kontrolü yapıldı, çerezler güncellendi');
      }).catch(error => {
        console.error('Premium durum senkronizasyonu hatası:', error);
      });
    }
  }, [isLoaded, userId]);
  
  return null; // UI render etmiyoruz
} 