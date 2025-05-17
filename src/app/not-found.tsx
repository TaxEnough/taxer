'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import Navbar from '@/components/Navbar';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      
      <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center">
            <Image 
              src="/images/404.svg"
              alt="404 Not Found"
              width={300}
              height={200}
              className="h-48 w-auto mx-auto"
            />
            
            <h1 className="mt-6 text-3xl font-extrabold text-gray-900">
              Page not found
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              The page you are looking for doesn't exist or has been moved.
            </p>
            
            <div className="mt-8 space-y-4">
              <Link 
                href="/"
                className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Back to home
              </Link>
              
              <div className="text-sm">
                <Link 
                  href="/support"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Need help? Contact support
                </Link>
              </div>
            </div>
            
            <div className="mt-10 p-6 bg-white rounded-lg shadow-sm">
              <h2 className="text-lg font-medium text-gray-900">
                Popular pages
              </h2>
              <ul className="mt-3 grid grid-cols-1 gap-3">
                <li>
                  <Link 
                    href="/dashboard"
                    className="flex items-center p-3 rounded-md hover:bg-gray-50"
                  >
                    <div className="text-blue-600">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Dashboard</p>
                    </div>
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/pricing"
                    className="flex items-center p-3 rounded-md hover:bg-gray-50"
                  >
                    <div className="text-blue-600">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Pricing</p>
                    </div>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 