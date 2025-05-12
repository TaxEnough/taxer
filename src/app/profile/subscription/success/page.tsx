'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

export default function SubscriptionSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Premium erişim aktifleştiriliyor...');
  
  useEffect(() => {
    if (!isLoaded) return;
    
    const activatePremium = async () => {
      try {
        // Kullanıcı bilgisini al
        const email = searchParams.get('email') || user?.primaryEmailAddress?.emailAddress || '';
        const userIdParam = searchParams.get('userId') || user?.id || '';
        const plan = searchParams.get('plan') || 'premium';
        
        // Premium erişimi aktifleştir
        if (userIdParam) {
          console.log(`[Premium Success] Activating premium via API for user: ${userIdParam}`);
          
          // API endpoint'i çağır
          const response = await fetch('/api/subscription/activate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: userIdParam,
              email,
              plan,
              source: 'success_page'
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API Error');
          }
          
          const result = await response.json();
          console.log('[Premium Success] API response:', result);
          
          setStatus('success');
          setMessage('Premium erişim aktifleştirildi! Tüm özelliklere erişebilirsiniz.');
          
          // 3 saniye sonra yönlendir
          setTimeout(() => {
            router.push('/dashboard');
          }, 3000);
        } else {
          // Kullanıcı ID'si yoksa hataya ayarla
          setStatus('error');
          setMessage('Kullanıcı bilgisi bulunamadı. Lütfen giriş yapıp tekrar deneyin.');
        }
      } catch (error: any) {
        console.error('[Premium Success] Error:', error);
        setStatus('error');
        setMessage(`Hata: ${error.message}`);
      }
    };
    
    activatePremium();
  }, [isLoaded, user, searchParams, router]);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-md w-full p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
        <div className="text-center">
          {status === 'loading' && (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 dark:border-blue-300 rounded-full border-t-transparent"></div>
            </div>
          )}
          
          {status === 'success' && (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          
          {status === 'error' && (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {status === 'loading' && 'Ödeme İşleniyor...'}
            {status === 'success' && 'Ödeme Başarılı!'}
            {status === 'error' && 'İşlem Sırasında Hata!'}
          </h2>
          
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {message}
          </p>
          
          {status === 'success' && (
            <div className="animate-pulse flex items-center justify-center">
              <span className="mr-2 text-sm text-gray-500 dark:text-gray-400">
                Dashboard'a yönlendiriliyorsunuz
              </span>
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animation-delay-200"></div>
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animation-delay-400"></div>
              </div>
            </div>
          )}
          
          {status === 'error' && (
            <button 
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Dashboard'a Dön
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 