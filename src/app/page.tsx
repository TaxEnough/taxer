"use client";

import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <>
      <Navbar />
      <div className="hero min-h-[70vh] bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 mb-6 md:mb-0 md:pr-10">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-4">
              Complete investment & tax solution
            </h1>
            <p className="text-xl text-gray-600 mb-6">
            All-in-one platform for tax calculation, portfolio management, and investment tracking. Simplify your financial decisions with our powerful tools and detailed analytics.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register" passHref className="btn bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg font-medium text-center">
                Start Free
              </Link>
              <Link href="/pricing" passHref className="btn bg-gray-100 hover:bg-gray-200 text-gray-800 px-8 py-3 rounded-lg font-medium text-center">
                Pricing
              </Link>
            </div>
          </div>
          <div className="md:w-1/2">
            <Image
              src="/images/investment-dashboard.jpg"
              alt="TaxEnough Dashboard"
              width={700}
              height={500}
              className="rounded-lg shadow-xl"
            />
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-50 to-transparent"></div>
      </div>

      {/* Features Section */}
      <section id="features" className="py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Features</h2>
            <p className="mt-3 text-xl text-gray-600 max-w-3xl mx-auto">
              We make tax calculation easier
            </p>
            <p className="mt-2 text-lg text-gray-500 max-w-3xl mx-auto">
              Calculating your investment taxes with Tax Enough is now much easier and faster.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Easy Data Entry</h3>
              <p className="text-gray-600">
                Enter your stock transactions manually or upload CSV/Excel files downloaded from your broker account.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Accurate Calculation</h3>
              <p className="text-gray-600">
                Automatically calculate your short and long-term capital gains and learn your tax obligations.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">User-Friendly Interface</h3>
              <p className="text-gray-600">
                You can easily make your tax calculations thanks to our simple and intuitive interface.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900">Tax Calculation and Portfolio Management Solution for Investors</h2>
            <p className="mt-2 text-sm text-gray-500 max-w-2xl mx-auto">
              Simplify tax calculations and track your investments in one place.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Basic</h3>
              <div className="flex items-baseline mb-8">
                <span className="text-5xl font-extrabold text-gray-900">$19.99</span>
                <span className="text-gray-500 ml-1">/month</span>
              </div>
              <p className="text-gray-500 mb-8">
                For individual investors.
              </p>
              <ul className="space-y-4 mb-10">
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Basic tax calculations</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Tax estimate reports</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Annual tax summary</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Email support</span>
                </li>
              </ul>
              <Link href="/register" passHref className="block w-full text-center bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg">
                Get Started
              </Link>
            </div>
            
            <div className="bg-white border border-primary-500 rounded-lg p-8 shadow-sm relative transform scale-105">
              <div className="absolute top-0 right-0 bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Premium</h3>
              <div className="flex items-baseline mb-8">
                <span className="text-5xl font-extrabold text-gray-900">$29.99</span>
                <span className="text-gray-500 ml-1">/month</span>
              </div>
              <p className="text-gray-500 mb-8">
                For active traders.
              </p>
              <ul className="space-y-4 mb-10">
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Everything in Basic</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Faster support response</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Reminder setup options</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Priority email support</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Multi-portfolio management</span>
                </li>
              </ul>
              <Link href="/register" passHref className="block w-full text-center bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg">
                Get Started
              </Link>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link href="/pricing" passHref className="inline-flex items-center text-primary-600 hover:text-primary-800">
              View full pricing details
              <svg className="ml-2 w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
} 