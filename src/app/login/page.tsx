'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { SignIn } from '@clerk/nextjs';
import { useUser } from '@clerk/nextjs';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();

  // Kullanıcı zaten giriş yapmışsa dashboard'a yönlendir
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/dashboard');
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-grow flex items-center justify-center p-4">
        <SignIn
          appearance={{
            elements: {
              rootBox: {
                width: '100%',
                maxWidth: '480px',
              },
              card: {
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              },
            },
          }}
          afterSignInUrl="/dashboard"
          redirectUrl="/dashboard"
        />
      </div>

      <Footer />
    </div>
  );
} 