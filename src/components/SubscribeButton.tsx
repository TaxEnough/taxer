'use client';

import { useState } from 'react';
import { getStripe } from '@/lib/stripe';

interface SubscribeButtonProps {
  priceId: string;
  className?: string;
  children?: React.ReactNode;
}

export default function SubscribeButton({ priceId, className = '', children }: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Starting subscription process for price ID:', priceId);
      
      // GET isteği için URL'yi ve parametreleri hazırla
      const successUrl = `${window.location.origin}/dashboard?subscription=success`;
      const cancelUrl = `${window.location.origin}/pricing?subscription=cancelled`;
      
      // GET isteği ile çalışacak yeni API endpoint'i
      const API_URL = `/api/payment/checkout?priceId=${encodeURIComponent(priceId)}&successUrl=${encodeURIComponent(successUrl)}&cancelUrl=${encodeURIComponent(cancelUrl)}`;
      
      console.log('Sending request to:', API_URL);
      
      // Basit bir GET isteği yap
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      // HTTP Status kodunu kontrol et
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Ödeme sistemi yanıt vermedi (${response.status}). Lütfen daha sonra tekrar deneyin.`);
      }
      
      // Yanıtı JSON olarak parse et
      const data = await response.json();
      
      console.log('Checkout session created:', data);
      
      // Check if we have a URL to redirect to
      if (!data.url) {
        console.error('No checkout URL received from server');
        setError('Ödeme sayfası oluşturulamadı. Lütfen tekrar deneyin.');
        return;
      }
      
      // Doğrudan Stripe URL'sine yönlendir
      console.log('Redirecting to Stripe checkout:', data.url);
      window.location.href = data.url;
      
    } catch (error: any) {
      console.error('Error subscribing:', error);
      
      // Set a more generic but helpful error message
      setError(`Ödeme işlemi başlatılamadı: ${error.message}`);
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
        {loading ? 'İşleniyor...' : children || 'Abone Ol'}
      </button>
      
      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
} 