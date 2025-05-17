'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import Image from 'next/image';

export default function Support() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  
  // Toggle FAQ expansion
  const toggleFaq = (index: number) => {
    if (expandedFaq === index) {
      setExpandedFaq(null);
    } else {
      setExpandedFaq(index);
    }
  };
  
  // Track form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Form submission process
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);
    
    try {
      // Form validation
      if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
        throw new Error('Please fill in all fields.');
      }
      
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address.');
      }
      
      // Send form data to email API
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Failed to send your message.');
        }
        
        // Show success message
        setSubmitStatus({
          success: true,
          message: 'Your message has been sent successfully. We will get back to you as soon as possible.'
        });
        
        // Reset form
        setFormData({
          name: '',
          email: '',
          message: ''
        });
      } catch (apiError) {
        console.error("API error: ", apiError);
        throw new Error('Error sending your message. Please try again later.');
      }
    } catch (error) {
      // Show error message
      setSubmitStatus({
        success: false,
        message: error instanceof Error ? error.message : 'An error occurred. Please try again later.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // FAQ items
  const faqItems = [
    {
      question: "How do I start tracking my investments?",
      answer: "After creating an account and logging in, navigate to the Transactions page and click on 'New Transaction' to add your investment details. You can add both buy and sell transactions to track your gains and potential tax liabilities."
    },
    {
      question: "What tax information does Tax Enough provide?",
      answer: "Tax Enough provides estimates of capital gains taxes on your investment transactions based on current U.S. tax laws. This includes calculations for short-term and long-term capital gains. Please note that these are estimates only and should not replace professional tax advice."
    },
    {
      question: "Is my financial data secure?",
      answer: "Yes, we take security seriously. All data is encrypted both in transit and at rest. We use industry-standard security practices and never share your financial information with third parties without your explicit consent."
    },
    {
      question: "Can I import transactions from my brokerage?",
      answer: "Currently, you can upload CSV files from major brokerages through our import tool. Go to Transactions > Upload to use this feature. We're continually adding support for more brokerages."
    },
    {
      question: "How accurate are the tax calculations?",
      answer: "Our calculations are based on current U.S. tax laws and are designed to give you a reasonable estimate of potential tax liabilities. However, tax laws are complex and subject to change. Always consult with a tax professional for definitive advice."
    },
    {
      question: "Can I use Tax Enough if I'm not in the United States?",
      answer: "You can use our tools for your investments in any country of your choice, however, please note that our tax calculation tools are specifically designed for the U.S. tax system."
    }
  ];
  
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900">Support</h1>
          </div>
        </header>
        
        <main>
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {/* Contact and General Support Section */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900">Contact Support</h2>
                <div className="mt-4 flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-900">
                      For support inquiries, please email us at <a href="mailto:support@taxenough.com" className="font-medium text-blue-600 hover:text-blue-500">support@taxenough.com</a>
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      We aim to respond to all inquiries within 24-48 business hours.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Contact Form Section */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">Contact Form</h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter your full name"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter your email address"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      rows={4}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter your message"
                    />
                  </div>
                  
                  {submitStatus && (
                    <div className={`p-3 rounded-md ${submitStatus.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {submitStatus.message}
                    </div>
                  )}
                  
                  <div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                      {isSubmitting ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            
            {/* FAQ Section */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">Frequently Asked Questions</h2>
                
                <div className="mt-2 space-y-4">
                  {faqItems.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-md">
                      <button
                        className="w-full px-4 py-3 flex justify-between items-center text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={() => toggleFaq(index)}
                      >
                        <span className="text-sm font-medium text-gray-900">{item.question}</span>
                        <svg 
                          className={`h-5 w-5 text-gray-500 transform ${expandedFaq === index ? 'rotate-180' : 'rotate-0'} transition-transform duration-200`} 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedFaq === index && (
                        <div className="px-4 pb-3 pt-1">
                          <p className="text-sm text-gray-500">{item.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500">
                    Still have questions? Contact our support team at <a href="mailto:support@taxenough.com" className="font-medium text-blue-600 hover:text-blue-500">support@taxenough.com</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
} 