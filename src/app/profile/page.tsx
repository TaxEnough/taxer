'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useUser, useClerk } from '@clerk/nextjs';

// Basit bir abonelik bilgisi bileşeni
const SimpleSubscriptionInfo = () => {
  const { user, isLoaded } = useUser();
  const [subscription, setSubscription] = useState({
    plan: 'Free Plan',
    status: 'Free',
    renewalDate: null as string | null
  });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (isLoaded && user) {
      try {
        // any tipini kullanmak zorundayız çünkü Clerk tiplerindeki privateMetadata'yı
        // doğrudan erişemiyoruz
        const subData = (user as any).privateMetadata?.subscription || 
                        (user as any).publicMetadata?.subscription;
        
        if (subData && subData.status === 'active') {
          let endDate = null;
          if (subData.currentPeriodEnd) {
            const date = new Date(subData.currentPeriodEnd);
            endDate = date.toLocaleDateString('en-US', {
              year: 'numeric', 
              month: 'long', 
              day: 'numeric'
            });
          }
          
          setSubscription({
            plan: subData.plan === 'premium' ? 'Premium Plan' : 'Basic Plan',
            status: 'Active',
            renewalDate: endDate
          });
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [isLoaded, user]);
  
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="bg-gray-50 p-6 rounded-lg mb-6">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Current Plan</dt>
            <dd className="mt-1">
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                subscription.plan === 'Premium Plan' 
                  ? 'bg-purple-100 text-purple-800' 
                  : subscription.plan === 'Basic Plan'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {subscription.plan}
              </span>
            </dd>
          </div>
          
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1 text-sm">
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                subscription.status === 'Active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {subscription.status}
              </span>
            </dd>
          </div>
          
          {subscription.renewalDate && (
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Renewal Date</dt>
              <dd className="mt-1 text-sm text-gray-900">{subscription.renewalDate}</dd>
            </div>
          )}
        </dl>
      </div>
      
      {/* Action Buttons */}
      <div>
        <button 
          onClick={() => window.location.href = '/pricing'}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          {subscription.status === 'Active' ? 'Change Plan' : 'View Plans'}
        </button>
      </div>
    </div>
  );
};

export default function ProfilePage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded } = useUser();
  const { openUserProfile } = useClerk();
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  // Kullanıcı oturum açmadıysa veya veri yüklenemiyorsa, ana sayfaya yönlendirme
  useEffect(() => {
    if (isLoaded) {
      if (!clerkUser) {
        router.push('/');
      } else {
        setPageLoading(false);
      }
    }
  }, [isLoaded, clerkUser, router]);

  if (!isLoaded || pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 min-h-screen">
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Account Settings</h1>
          
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('profile')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'profile'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('subscription')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'subscription'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Subscription
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'security'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Security
              </button>
            </nav>
          </div>
          
          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'profile' && (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h2 className="text-lg font-medium text-gray-900">Personal Information</h2>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">Your personal details and profile settings.</p>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{clerkUser?.fullName || 'Not specified'}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Email Address</dt>
                      <dd className="mt-1 text-sm text-gray-900">{clerkUser?.primaryEmailAddress?.emailAddress || 'Not available'}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Account ID</dt>
                      <dd className="mt-1 text-sm text-gray-900">{clerkUser?.id || 'Not available'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
            
            {activeTab === 'subscription' && (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h2 className="text-lg font-medium text-gray-900">Subscription Management</h2>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">Manage your subscription plan and billing preferences.</p>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <SimpleSubscriptionInfo />
                </div>
              </div>
            )}
            
            {activeTab === 'security' && (
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h2 className="text-lg font-medium text-gray-900">Security Settings</h2>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">Manage your account security and sign-in methods.</p>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                  <div className="prose">
                    <p>Security settings are managed through your Clerk account.</p>
                    <div className="mt-4">
                      <button 
                        onClick={() => openUserProfile()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        Manage Security Settings
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
} 