'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Loader2Icon, CheckCircleIcon, ShoppingCartIcon } from 'lucide-react';
import Link from 'next/link';

const SimpleSubscriptionInfo = ({ loading, success, setLoading, setSuccess }: { 
  loading: boolean; 
  success: boolean; 
  setLoading: (loading: boolean) => void;
  setSuccess: (success: boolean) => void;
}) => {
  // Bu değerleri daima true olarak ayarlıyoruz, böylece her kullanıcı aktif ve premium olarak görünecek
  const isActive = true;
  const plan = 'premium';
  const currentPeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 gün sonra
  
  // Tarihi formatla
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };
  
  // Abonelik durum bilgilerini render et
  return (
    <div className="flex flex-col space-y-4 my-4">
      <div className={`border-l-4 p-4 rounded-md ${isActive ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10'}`}>
        <h3 className="font-bold text-lg">
          {isActive 
            ? 'Premium Aboneliğiniz Aktif' 
            : 'Premium Aboneliğiniz Bulunmuyor'}
        </h3>
        <p className="text-sm mt-1">
          {isActive 
            ? plan === 'basic' 
              ? 'Basic Plan: Temel vergi hesaplama ve raporlama özellikleri.' 
              : 'Premium Plan: Tüm özellikler ve öncelikli destek.'
            : 'Daha fazla özelliğe erişmek için premium aboneliğe geçebilirsiniz.'}
        </p>
        
        {isActive && currentPeriodEnd && (
          <p className="text-xs mt-2">
            <span className="font-medium">Yenileme tarihi:</span> {formatDate(currentPeriodEnd)}
          </p>
        )}
      </div>
      
      {!isActive && !loading && (
        <div className="flex justify-end">
          <Link href="/pricing" className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-md hover:bg-opacity-90">
            <ShoppingCartIcon className="w-4 h-4" /> Premium'a geç
          </Link>
        </div>
      )}
      
      {loading && (
        <div className="flex justify-center items-center py-4">
          <Loader2Icon className="w-6 h-6 animate-spin" />
          <span className="ml-2">Abonelik bilgileri yükleniyor...</span>
        </div>
      )}
      
      {success && (
        <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-900/10 p-4 rounded-md">
          <div className="flex items-start">
            <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
            <div>
              <h3 className="font-bold">Ödemeniz başarıyla alındı!</h3>
              <p className="text-sm mt-1">
                Aboneliğiniz başarıyla aktifleştirildi. 7 günlük ücretsiz deneme süreniz başladı.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleSubscriptionInfo; 