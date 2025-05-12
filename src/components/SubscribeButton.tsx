'use client';

import { useState, useEffect } from 'react';
import { getStripe } from '@/lib/stripe';
import { useUser } from '@clerk/nextjs';

interface SubscribeButtonProps {
  priceId: string;
  className?: string;
  children?: React.ReactNode;
}

export default function SubscribeButton({ priceId, className = '', children }: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSignedIn, user } = useUser();
  
  const handleSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Starting subscription process for price ID:', priceId);
      
      // URL'leri hazırla - success URL'ini güncelliyoruz
      const successUrl = `${window.location.origin}/profile/subscription/success`;
      const cancelUrl = `${window.location.origin}/pricing?subscription=cancelled`;
      
      // Kullanıcı bilgilerini alıp istek verilerine ekle
      let userId = '';
      let email = '';
      
      if (isSignedIn && user) {
        userId = user.id;
        email = user.primaryEmailAddress?.emailAddress || '';
        console.log('User info for payment:', { userId, email });
      }
      
      // Birden fazla API endpoint'i ayarla ve sırayla dene
      // Bu Vercel'deki sorunları çözmek için fallback mekanizması oluşturur
      const API_ENDPOINTS = [
        '/api/payment/create-checkout',
        '/api/checkout',
        '/api/payment/checkout'
      ];
      
      let response = null;
      let lastError = null;
      
      // Her endpoint'i sırayla dene, birinin başarılı olmasını bekle
      for (const endpoint of API_ENDPOINTS) {
        try {
          console.log(`Attempting payment request to: ${endpoint}`);
          
          // URL parametrelerini ekle
          const successUrlWithParams = `${successUrl}?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}&plan=${priceId.includes('premium') ? 'premium' : 'basic'}`;
          
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              priceId,
              successUrl: successUrlWithParams,
              cancelUrl,
              userId,
              email
            })
          });
          
          console.log(`Response from ${endpoint}:`, { 
            status: response.status,
            statusText: response.statusText
          });
          
          // İşlem başarılıysa döngüden çık
          if (response.ok) {
            console.log(`Successful response from ${endpoint}`);
            break;
          } else {
            // Başarısız ama yanıt aldık, sonraki endpoint'i denemeden önce bu hata bilgisini sakla
            lastError = new Error(`${endpoint} sunucusu ${response.status} hata kodu döndürdü: ${response.statusText}`);
            console.error(`Error from ${endpoint}:`, lastError);
          }
        } catch (fetchError) {
          // İstek hatası, sonraki endpoint'i dene
          console.error(`Fetch error with ${endpoint}:`, fetchError);
          lastError = fetchError;
        }
      }
      
      // Tüm endpoint'ler denendikten sonra hala başarılı yanıt yoksa hata fırlat
      if (!response || !response.ok) {
        throw lastError || new Error('Tüm ödeme endpoint\'leri başarısız oldu.');
      }
      
      // Headers'ı güvenli bir şekilde log yapalım
      const headersObj: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      console.log('Response headers:', headersObj);
      
      // Response tipini kontrol et
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Non-JSON response received:', contentType);
        const responseText = await response.text();
        console.error('Response body:', responseText.substring(0, 300));
        throw new Error(`Sunucu JSON yanıt vermedi. Detaylar için konsola bakın.`);
      }
      
      // Yanıtı JSON olarak parse et
      const data = await response.json();
      
      console.log('Checkout session created:', data);
      
      // Check if we have a URL to redirect to
      if (!data.url) {
        console.error('No checkout URL received from server');
        setError('Ödeme URL adresi alınamadı. Lütfen tekrar deneyin.');
        return;
      }
      
      // Doğrudan Stripe URL'sine yönlendir
      console.log('Redirecting to Stripe checkout:', data.url);
      window.location.href = data.url;
      
    } catch (error: any) {
      console.error('Error subscribing:', error);
      
      // Türkçe hata mesajı
      setError(`Ödeme sistemi hatası: ${error.message || 'Beklenmeyen bir hata oluştu'}. Lütfen daha sonra tekrar deneyin veya destek ile iletişime geçin.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSubscription}
        disabled={loading}
        className={`${className} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {loading ? 'Processing...' : children || 'Subscribe'}
      </button>
      
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
} 