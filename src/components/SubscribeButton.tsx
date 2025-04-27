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

  const handleSubscription = async () => {
    try {
      setLoading(true);
      
      // Create a checkout session via the API
      const { data } = await axios.post('/api/checkout', {
        priceId,
        successUrl: `${window.location.origin}/dashboard?subscription=success`,
        cancelUrl: `${window.location.origin}/pricing?subscription=cancelled`,
      });
      
      // Redirect to Stripe Checkout
      const stripe = await getStripe();
      if (stripe && data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSubscription}
      disabled={loading}
      className={`${className} ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      {loading ? 'Processing...' : children || 'Subscribe'}
    </button>
  );
} 