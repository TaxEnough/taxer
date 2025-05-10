'use client';

import { SignUp } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function RegisterPage() {
  return (
    <>
      <Navbar />
      <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Or{' '}
              <a href="/login" className="font-medium text-primary-600 hover:text-primary-500">
                sign in to your existing account
              </a>
            </p>
          </div>
          
          <div className="mt-8">
            <SignUp 
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
            />
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
} 