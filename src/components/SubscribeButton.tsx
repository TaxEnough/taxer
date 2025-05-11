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
      
      // URL'nin doğru olduğundan emin olalım
      const successUrl = `${window.location.origin}/dashboard?subscription=success`;
      const cancelUrl = `${window.location.origin}/pricing?subscription=cancelled`;
      
      // API'nin sonundaki trailing slash önemli olabilir
      const API_URL = `/api/payment/create-session`;
      
      console.log('Sending request to:', API_URL);
      
      // POST isteği yapalım (GET isteği ile rota çakışması oluyor)
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          successUrl,
          cancelUrl
        })
      });
      
      console.log('Response status:', response.status);
      
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
        console.error('Response body:', responseText.substring(0, 200) + '...');
        throw new Error(`Server returned ${response.status} with non-JSON response. Check console for details.`);
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