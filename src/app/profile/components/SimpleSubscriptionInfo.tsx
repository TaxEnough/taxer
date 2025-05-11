'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Loader2Icon, CheckCircleIcon, ShoppingCartIcon } from 'lucide-react';
import Link from 'next/link';

const SimpleSubscriptionInfo = ({ 
  loading, 
  success, 
  subscription, 
  error 
}: { 
  loading: boolean; 
  success: boolean; 
  subscription?: any;
  error?: string;
}) => {
  const isActive = subscription?.status === 'Active';
  const plan = subscription?.plan || 'Free Plan';
  const currentPeriodEnd = subscription?.renewalDate ? new Date(subscription.renewalDate) : null;
  
  // Tarihi formatla
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-black" />
        <span className="ml-2">Abonelik bilgileri yükleniyor...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="border-l-4 border-red-500 bg-red-50 dark:bg-red-900/10 p-4 rounded-md">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }
  
  // Abonelik durum bilgilerini render et
  return (
    <div className="flex flex-col space-y-4 my-4">
      <div className={`border-l-4 p-4 rounded-md ${isActive ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10'}`}>
        <h3 className="font-bold text-lg">
          {isActive 
            ? `${plan} Aboneliğiniz Aktif` 
            : 'Aboneliğiniz Bulunmuyor'}
        </h3>
        <p className="text-sm mt-1">
          {isActive 
            ? plan === 'Basic Plan' 
              ? 'Basic Plan: Temel vergi hesaplama ve raporlama özellikleri.' 
              : plan === 'Premium Plan'
                ? 'Premium Plan: Tüm özellikler ve öncelikli destek.'
                : 'Free Plan: Sınırlı özelliklere erişim.'
            : 'Daha fazla özelliğe erişmek için ücretli aboneliğe geçebilirsiniz.'}
        </p>
        
        {isActive && currentPeriodEnd && (
          <p className="text-xs mt-2">
            <span className="font-medium">Yenileme tarihi:</span> {formatDate(currentPeriodEnd)}
          </p>
        )}
      </div>
      
      {!isActive && (
        <div className="flex justify-end">
          <a href="/pricing" className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-md hover:bg-opacity-90">
            <span className="w-4 h-4">🛒</span> Premium'a geç
          </a>
        </div>
      )}
      
      {success && (
        <div className="border-l-4 border-green-500 bg-green-50 dark:bg-green-900/10 p-4 rounded-md">
          <div className="flex items-start">
            <span className="text-green-500 mr-2 mt-0.5">✓</span>
            <div>
              <h3 className="font-bold">Ödemeniz başarıyla alındı!</h3>
              <p className="text-sm mt-1">
                Aboneliğiniz başarıyla aktifleştirildi.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleSubscriptionInfo; 