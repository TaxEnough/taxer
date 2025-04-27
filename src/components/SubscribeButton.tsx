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
      const { data } = await axios.post('/api/checkout', {
        priceId,
        successUrl: `${window.location.origin}/dashboard?subscription=success`,
        cancelUrl: `${window.location.origin}/pricing?subscription=cancelled`,
      });
      
      console.log('Checkout session created:', data);
      
      // Check if we have a URL to redirect to
      if (!data.url) {
        console.error('No checkout URL received from server');
        setError('No checkout URL received. Please try again.');
        return;
      }
      
      // Redirect to Stripe Checkout
      const stripe = await getStripe();
      if (stripe) {
        console.log('Redirecting to Stripe checkout:', data.url);
        window.location.href = data.url;
      } else {
        console.error('Stripe failed to initialize');
        setError('Payment system failed to initialize. Please try again.');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Something went wrong';
      console.error('Error subscribing:', error);
      console.error('Response data:', error.response?.data);
      setError(`Error: ${errorMessage}`);
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