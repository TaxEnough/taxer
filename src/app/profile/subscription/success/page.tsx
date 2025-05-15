'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { setPremiumCookies } from '@/lib/clerk-utils';

export default function SuccessPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function handleSuccessRedirect() {
      try {
        if (!isLoaded) return;
        
        // Ödeme başarılı olduğu için kullanıcıyı premium yapalım
        if (user) {
          console.log('Setting premium status for user after successful payment');
          
          try {
            // Update using Clerk's metadata API
            await fetch('/api/subscription/update-metadata', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: user.id,
                metadata: {
                  subscriptionStatus: 'active',
                  subscriptionPlan: 'premium',
                  isPremium: true
                }
              }),
            });
            
            console.log('User metadata updated!');
            
            // Set premium cookies
            console.log('Setting premium cookies...');
            await setPremiumCookies();
            
            // Final API call to synchronize premium status and cookies
            await fetch('/api/subscription/check-premium', {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            });
          } catch (err) {
            console.error('Error setting premium status:', err);
          }
        }
        
        // Kısa bir süre sonra ana sayfaya yönlendir
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } catch (err) {
        console.error('Error in success page:', err);
        // Hata olsa bile ana sayfaya yönlendir
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } finally {
        setLoading(false);
      }
    }

    handleSuccessRedirect();
  }, [isLoaded, user, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <div className="text-center max-w-md">
        <div className="text-green-500 text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-semibold mb-2">Payment Completed!</h2>
        <p className="text-gray-600 mb-4">
          Thank you! Your premium subscription has been activated. You are being redirected to the homepage...
        </p>
        {loading && (
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mt-4"></div>
        )}
      </div>
    </div>
  );
} 