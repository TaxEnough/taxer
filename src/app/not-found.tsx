'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      
      <div className="flex-grow flex items-center justify-center">
        <div className="max-w-2xl w-full mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="mb-10 flex justify-center">
            <img 
              src="/images/logo_text.png" 
              alt="TaxEnough Logo" 
              width="250"
              className="h-auto"
            />
          </div>
          
          <h1 className="text-6xl font-extrabold text-gray-900 mb-6">
            <span className="text-blue-600">404</span> Error
          </h1>
          
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-gray-50 text-gray-500">Page Not Found</span>
            </div>
          </div>
          
          <p className="text-lg text-gray-600 mb-8">
            Oops! We couldn't find the page you're looking for. It might have been moved or deleted.
          </p>
          
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">What can you do?</h2>
            <ul className="text-left text-gray-600 space-y-2">
              <li>• Check if the URL is correct</li>
              <li>• Go back to our <a href="/" className="text-blue-600 hover:underline">homepage</a></li>
              <li>• Check out our <a href="/blog" className="text-blue-600 hover:underline">blog</a> for latest updates</li>
              <li>• Calculate your <a href="/dashboard" className="text-blue-600 hover:underline">tax obligations</a></li>
            </ul>
          </div>
          
          <div className="mt-8">
            <a 
              href="/"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Return to Homepage
            </a>
          </div>
          
          <div className="mt-12 flex justify-center">
            <div className="w-16 h-16 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></div>
                <div className="relative inline-flex rounded-full h-12 w-12 bg-blue-600 text-white flex items-center justify-center text-xl font-bold">
                  404
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
} 