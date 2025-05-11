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
      
      // URL'nin doğru olduğundan emin olalım - tam (absolute) URL kullanalım
      const successUrl = `${window.location.origin}/dashboard?subscription=success`;
      const cancelUrl = `${window.location.origin}/pricing?subscription=cancelled`;
      
      // API URL'sini düzelt - trailing slash ekle (Next.js'te bazen önemli)
      const API_URL = `/api/payment/checkout?priceId=${encodeURIComponent(priceId)}&successUrl=${encodeURIComponent(successUrl)}&cancelUrl=${encodeURIComponent(cancelUrl)}`;
      
      console.log('Sending request to:', API_URL);
      
      // Basit bir GET isteği yap
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      // Response tipini kontrol et
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Non-JSON response received:', contentType);
        const responseText = await response.text();
        console.error('Response body:', responseText.substring(0, 200) + '...');
        throw new Error(`Server returned ${response.status} with non-JSON response`);
      }
      
      // HTTP Status kodunu kontrol et
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', {
          status: response.status,
          statusText: response.statusText,
          data: errorData
        });
        throw new Error(`Server responded with ${response.status}: ${errorData.error || response.statusText}`);
      }
      
      // Yanıtı JSON olarak parse et
      const data = await response.json();
      
      console.log('Checkout session created:', data);
      
      // Check if we have a URL to redirect to
      if (!data.url) {
        console.error('No checkout URL received from server');
        setError('No checkout URL received. Please try again.');
        return;
      }
      
      // Doğrudan Stripe URL'sine yönlendir
      console.log('Redirecting to Stripe checkout:', data.url);
      window.location.href = data.url;
      
    } catch (error: any) {
      console.error('Error subscribing:', error);
      
      // İngilizce hata mesajı
      setError(`Payment system error: ${error.message}. Please try again later or contact support.`);
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