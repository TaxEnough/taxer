'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Image from 'next/image';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl flex items-center justify-center">
            About&nbsp;
            <Image 
              src="/images/text.png" 
              alt="TaxEnough" 
              width={200} 
              height={50}
              className="inline-block"
            />
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            Understanding your investment taxes, simplified.
          </p>
        </div>
        
        <div className="mt-16">
          <div className="bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="p-8 lg:p-12">
              <div className="prose prose-lg max-w-none text-gray-700">
                <div className="mb-12 flex flex-col md:flex-row items-center gap-8">
                  <div className="md:w-1/2 flex justify-center items-center bg-gray-100 p-8 rounded-lg">
                    <Image 
                      src="/images/logo.png" 
                      alt="TaxEnough" 
                      width={300} 
                      height={80}
                      className="w-auto h-auto"
                    />
                  </div>
                  <div className="md:w-1/2">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Mission</h2>
                    <p className="text-lg">
                      Paying taxes on investments can be confusing. At Tax Enough, we're here to make it simpler.
                    </p>
                    <p className="text-lg mt-4">
                      We help you estimate the taxes you might owe on your U.S. investment income using fast and reliable calculation tools. No complex forms. No overwhelming tax codes. Just clear numbers based on the latest rules.
                    </p>
                  </div>
                </div>
                
                <div className="my-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">What We Offer</h2>
                  
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Tax Calculation Tools</h3>
                      <p>
                        Our platform is designed for individual investors who want to understand their potential tax burden from dividends, capital gains, or other types of investment income. We provide smart algorithms that turn your inputs into valuable insights.
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Investment Journal</h3>
                      <p>
                        Keep track of your transactions with our personal Investment Journal. Record your trades, monitor your activity, and stay organized throughout the year. When tax season arrives, you'll be better prepared and less stressed.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="my-12 bg-blue-50 p-8 rounded-lg border border-blue-100">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Philosophy</h2>
                  <p className="text-lg">
                    Tax Enough is built to give you clarity and control. Use it any time of the year to calculate, plan, and make smarter decisions about your money.
                  </p>
                  <p className="text-xl font-medium text-blue-700 mt-4">
                    We believe you should only pay what you truly owe. Nothing more.
                  </p>
                </div>
                
                <div className="mt-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Important Note</h2>
                  <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                    <p>
                      We do not offer tax advice or financial consulting. Our tools are designed to help you understand your potential tax obligations, but they should not be considered a substitute for professional advice from a qualified tax professional or financial advisor.
                    </p>
                    <p className="mt-3">
                      Always consult with a tax professional before making important financial decisions.
                    </p>
                  </div>
                </div>
                
                <div className="mt-12 text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Ready to Get Started?</h2>
                  <Link 
                    href="/register" 
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Create Your Free Account
                  </Link>
                  <p className="mt-4 text-gray-500">
                    Already have an account? <Link href="/login" className="text-blue-600 hover:text-blue-800">Log in</Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 