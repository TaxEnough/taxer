'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { setPremiumCookies } from '@/lib/clerk-utils';

export default function SuccessPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Start post-payment process
    async function processPayment() {
      try {
        if (!isLoaded || !user) return;

        const searchParams = window.location.search;
        const params = new URLSearchParams(searchParams);
        const sessionId = params.get('session_id');
        
        if (!sessionId) {
          setError('Payment information not found.');
          setLoading(false);
          return;
        }

        console.log('Verifying payment information:', sessionId);
        
        // Verify payment information and activate subscription
        const response = await fetch('/api/subscription/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Payment could not be verified');
        }

        const data = await response.json();
        console.log('Payment status:', data);

        if (data.success) {
          // Update user metadata
          console.log('Updating user metadata...');
          
          try {
            // Update using Clerk's metadata API
            await updateUserMetadata({
              subscriptionStatus: 'active',
              subscriptionPlan: data.plan || 'premium',
              isPremium: true,
              subscriptionPeriodEnd: data.periodEnd,
              stripeCustomerId: data.customerId,
              stripeSubscriptionId: data.subscriptionId,
            });
            
            console.log('User metadata updated!');
          } catch (updateError) {
            console.error('Metadata update error:', updateError);
            setError('An error occurred while updating user information.');
            setLoading(false);
            return;
          }
          
          // Set premium cookies
          console.log('Setting premium cookies...');
          await setPremiumCookies();
          
          // Final API call to synchronize premium status and cookies
          await fetch('/api/subscription/check-premium', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          // Redirect to premium content after successful payment
          setLoading(false);
          router.push('/transactions');
          return;
        } else {
          setError('Payment could not be verified or subscription could not be activated.');
        }
      } catch (err) {
        console.error('Payment processing error:', err);
        setError('An error occurred while processing your payment. Please contact our support team.');
      }

      setLoading(false);
    }

    processPayment();
  }, [isLoaded, user, router]);

  // Helper function to update Clerk user metadata
  async function updateUserMetadata(metadata: any) {
    if (!user) return;
    
    // Update user metadata with API call
    const response = await fetch('/api/subscription/update-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        metadata
      }),
    });
    
    if (!response.ok) {
      throw new Error('User metadata could not be updated');
    }
    
    return response.json();
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      {loading ? (
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold mb-2">Processing Your Payment</h2>
          <p className="text-gray-600">Please wait, your payment is being verified...</p>
        </div>
      ) : error ? (
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold mb-2">An error occurred</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/pricing')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Pricing Page
          </button>
        </div>
      ) : (
        <div className="text-center max-w-md">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-semibold mb-2">Payment Completed!</h2>
          <p className="text-gray-600 mb-4">
            Thank you! Your premium subscription has been activated. You now have access to premium content.
          </p>
          <button
            onClick={() => router.push('/transactions')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Transactions Page
          </button>
        </div>
      )}
    </div>
  );
} 