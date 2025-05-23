'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import SubscribeButton from '@/components/SubscribeButton';
import { PRICES } from '@/lib/stripe';
import { useUser } from '@clerk/nextjs';

export default function Pricing() {
  const { user: firebaseUser } = useAuth();
  const { isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn, user: clerkUser } = useUser();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  useEffect(() => {
    // Log authentication status for debugging
    console.log('Auth state in pricing page:', { 
      isFirebaseLoggedIn: !!firebaseUser,
      isClerkSignedIn: isClerkSignedIn,
      isClerkLoaded: isClerkLoaded,
      clerkUser: clerkUser,
      firebaseUser: firebaseUser 
    });
    
    // Kullanıcının giriş yapmış olup olmadığını belirle
    // Önce Clerk'e bak, sonra Firebase'e fallback yap
    if (isClerkLoaded) {
      setIsAuthenticated(isClerkSignedIn || !!firebaseUser);
    } else {
      setIsAuthenticated(!!firebaseUser);
    }
  }, [firebaseUser, isClerkSignedIn, isClerkLoaded, clerkUser]);
  
  const calculateDiscount = (monthlyPrice: number, yearlyPrice: number) => {
    const yearlyTotal = monthlyPrice * 12;
    const savings = yearlyTotal - yearlyPrice;
    const discountPercentage = Math.round((savings / yearlyTotal) * 100);
    return {
      percentage: discountPercentage,
      savings: savings.toFixed(2)
    };
  };
  
  const plans = [
    {
      name: 'Basic',
      description: 'For individual investors.',
      monthlyPrice: PRICES.BASIC.MONTHLY.price,
      yearlyPrice: PRICES.BASIC.YEARLY.price,
      features: PRICES.BASIC.features,
      buttonText: 'Get Started',
      buttonColor: 'bg-primary-600 hover:bg-primary-700',
      borderColor: 'border-gray-200',
      popular: false,
      priceId: billingCycle === 'monthly' ? PRICES.BASIC.MONTHLY.id : PRICES.BASIC.YEARLY.id
    },
    {
      name: 'Premium',
      description: 'For active traders.',
      monthlyPrice: PRICES.PREMIUM.MONTHLY.price,
      yearlyPrice: PRICES.PREMIUM.YEARLY.price,
      features: PRICES.PREMIUM.features,
      buttonText: 'Get Started',
      buttonColor: 'bg-primary-600 hover:bg-primary-700',
      borderColor: 'border-primary-500',
      popular: true,
      priceId: billingCycle === 'monthly' ? PRICES.PREMIUM.MONTHLY.id : PRICES.PREMIUM.YEARLY.id
    }
  ];

  // Function to render the appropriate button based on user state
  const renderActionButton = (plan: any) => {
    // Log which button will be shown
    console.log(`Rendering button for ${plan.name} plan:`, { 
      isAuthenticated, 
      showingSubscribeButton: isAuthenticated, 
      priceId: plan.priceId 
    });
    
    if (!isAuthenticated) {
      return (
        <a 
          href="/register"
          className={`${plan.buttonColor} w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
        >
          Sign up to subscribe
        </a>
      );
    } else {
      return (
        <SubscribeButton 
          priceId={plan.priceId}
          className={`${plan.buttonColor} w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
        >
          {plan.buttonText}
        </SubscribeButton>
      );
    }
  };

  return (
    <>
      <Navbar />
      <main className="bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl sm:tracking-tight lg:text-4xl">
              Tax Calculation and Portfolio Management Solution for Investors
            </h1>
            
            {/* Billing toggle */}
            <div className="mt-6 flex justify-center">
              <div className="relative rounded-full p-1 bg-gray-100 flex">
                <button
                  type="button"
                  className={`${
                    billingCycle === 'monthly'
                      ? 'bg-white shadow-sm'
                      : 'bg-transparent'
                  } relative py-2 px-6 rounded-full text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary-500 focus:z-10`}
                  onClick={() => setBillingCycle('monthly')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`${
                    billingCycle === 'yearly'
                      ? 'bg-white shadow-sm'
                      : 'bg-transparent'
                  } relative py-2 px-6 rounded-full text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary-500 focus:z-10`}
                  onClick={() => setBillingCycle('yearly')}
                >
                  <span>Annually</span>
                  <span className="absolute -top-2 -right-12 bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {calculateDiscount(PRICES.BASIC.MONTHLY.price, PRICES.BASIC.YEARLY.price).percentage}% Off
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-y-8 sm:grid-cols-2 sm:gap-12 lg:grid-cols-2 lg:gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-lg shadow-lg overflow-hidden ${
                  plan.popular ? 'ring-2 ring-primary-500 transform scale-105' : ''
                }`}
              >
                <div className="p-6 bg-white">
                  {plan.popular && (
                    <div className="absolute top-0 right-0 -mr-2 -mt-2 bg-primary-500 rounded-bl-lg p-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-white px-2 py-1">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{plan.description}</p>
                  <p className="mt-3">
                    <span className="text-3xl font-extrabold text-gray-900">
                      ${billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                    </span>
                    <span className="text-sm font-medium text-gray-500">
                      {billingCycle === 'monthly' ? '/month' : '/year'}
                    </span>
                  </p>
                  
                  {billingCycle === 'yearly' && (
                    <p className="mt-1 text-sm text-green-500">
                      {calculateDiscount(plan.monthlyPrice, plan.yearlyPrice).percentage}% savings - ${calculateDiscount(plan.monthlyPrice, plan.yearlyPrice).savings}
                    </p>
                  )}
                  
                  <div className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg
                            className="h-6 w-6 text-green-500"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <p className="ml-3 text-base text-gray-700">{feature}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-8">
                    {renderActionButton(plan)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="px-4 py-3">
              <h2 className="text-xl font-bold text-center text-gray-900 mb-4">All plans include:</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <p className="ml-3 text-base text-gray-700">100% security for your data</p>
                </div>
                
                <div className="flex items-start justify-center">
                  <div className="flex-shrink-0 mr-3">
                    <svg className="h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-base text-gray-700">Cancel anytime</p>
                </div>
                
                <div className="flex items-start justify-center">
                  <div className="flex-shrink-0 mr-3">
                    <svg className="h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <p className="text-base text-gray-700">Limitless usage</p>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <p className="ml-3 text-base text-gray-700">Regular updates & new features</p>
                </div>
              </div>
              
              <p className="mt-6 text-base text-gray-600 text-center max-w-3xl mx-auto">
                Tax Enough helps you estimate your expected taxes with ease, so you can focus on growing your investments, not paperwork.
                Our Investment Journal helps you record and track your stock transactions in one place, and more tools are available to make managing your investments even easier.
              </p>
            </div>
          </div>

          <div className="mt-16">
            <h2 className="text-2xl font-extrabold text-gray-900 text-center mb-8">Frequently Asked Questions</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900">How do I make a payment?</h3>
                <p className="mt-2 text-base text-gray-600">
                  All major credit cards (Visa, Mastercard, American Express) are accepted. Payments are processed securely.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-gray-900">Can I cancel my subscription anytime?</h3>
                <p className="mt-2 text-base text-gray-600">
                  Yes, you can cancel your subscription at any time. You'll continue to have access to our services until the end of your billing period, and no renewal will occur.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-gray-900">How accurate are your tax calculations?</h3>
                <p className="mt-2 text-base text-gray-600">
                  Our algorithm-based calculation tools provide estimates based on information entered by the user and current tax data. These estimates are for informational purposes only and do not constitute official tax advice.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-gray-900">What is your refund policy?</h3>
                <p className="mt-2 text-base text-gray-600">
                  We provide refunds for eligible cancellations. Please visit our <a 
                    href="/refund"
                    className="text-primary-600 hover:text-primary-800 underline"
                  >refund policy page</a> for detailed information about our refund process and eligibility requirements.
                </p>
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-gray-900">Can I get technical support?</h3>
                <p className="mt-2 text-base text-gray-600">
                  Yes! All our plans include certain levels of support. Our Premium plan offers faster response times and priority support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
          </>
  );
} 