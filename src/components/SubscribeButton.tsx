'use client';

import { useState } from 'react';
import { getStripe } from '@/lib/stripe';
import axios from 'axios';

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
      
      // Create a checkout session via the API
      const { data } = await axios.post('/api/checkout', 
        {
          priceId,
          successUrl: `${window.location.origin}/dashboard?subscription=success`,
          cancelUrl: `${window.location.origin}/pricing?subscription=cancelled`,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
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
      
      // Detaylı hata mesajları
      if (error.response) {
        // Sunucu yanıtı varsa
        console.error('Error status:', error.response.status);
        console.error('Error headers:', error.response.headers);
        console.error('Error data:', error.response.data);
        
        if (error.response.status === 405) {
          setError(`API Error: Method not allowed. Please contact support.`);
        } else {
          const errorMessage = error.response.data?.error || `Server error: ${error.response.status}`;
          setError(`Error: ${errorMessage}`);
        }
      } else if (error.request) {
        // İstek yapıldı ama yanıt gelmedi
        console.error('No response received:', error.request);
        setError(`Network error: No response from server. Please check your connection.`);
      } else {
        // İstek yapılamadı
        console.error('Error message:', error.message);
        setError(`Error: ${error.message}`);
      }
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