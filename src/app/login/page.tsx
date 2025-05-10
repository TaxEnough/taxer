'use client';

import { SignIn } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useAuth } from '@/context/AuthContext';
import { getAuthTokenFromClient } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn } = useUser();
  const { user: firebaseUser, loading: firebaseLoading } = useAuth();

  // Kullanıcı zaten giriş yapmışsa dashboard'a yönlendir
  useEffect(() => {
    // Firebase token kontrolü
    const token = getAuthTokenFromClient();
    
    // Eğer kullanıcı Clerk ile giriş yapmışsa
    if (clerkLoaded && clerkSignedIn) {
      console.log('Kullanıcı zaten Clerk ile giriş yapmış, dashboard\'a yönlendiriliyor');
      router.push('/dashboard');
      return;
    }
    
    // Eğer kullanıcı Firebase ile giriş yapmışsa
    if (!firebaseLoading && (firebaseUser || token)) {
      console.log('Kullanıcı zaten Firebase ile giriş yapmış, dashboard\'a yönlendiriliyor');
      router.push('/dashboard');
      return;
    }
  }, [clerkLoaded, clerkSignedIn, firebaseUser, firebaseLoading, router]);

  return (
    <>
      <Navbar />
      <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Login to your account
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Or{' '}
              <a href="/register" className="font-medium text-primary-600 hover:text-primary-500">
                create a new account
              </a>
            </p>
          </div>
          
          <div className="mt-8">
            <SignIn 
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-md rounded-md border border-gray-200',
                  headerTitle: 'text-center text-2xl font-bold',
                  headerSubtitle: 'text-center text-gray-500 mb-4',
                  formButtonPrimary: 'bg-primary-600 hover:bg-primary-700',
                  socialButtonsBlockButton: 'border border-gray-300 hover:bg-gray-50',
                },
              }}
              // Clerk ile giriş yapıldıktan sonra doğrudan dashboard'a yönlendir
              redirectUrl="/dashboard"
            />
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
} 