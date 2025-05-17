'use client';

import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { getAuthTokenFromClient } from '@/lib/auth-client';

export default function ProfilePage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const { openUserProfile } = useClerk();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
    notifications: {
      email: true,
      browser: false
    }
  });
  
  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<null | 'saving' | 'success' | 'error'>(null);
  const [subscription, setSubscription] = useState({
    plan: 'Free Plan',
    status: 'Free',
    renewalDate: null as string | null
  });

  // URL'den query parametrelerini kontrol et
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const status = params.get('status');

      // URL'den gelen sekme parametresi varsa o sekmeyi aktif et
      if (tab === 'subscription' || tab === 'security') {
        setActiveTab(tab);
      } else {
        setActiveTab('personal');
      }
      
      // Ödeme başarılı olduysa bir başarı mesajı gösterebiliriz
      if (status === 'success') {
        // Burada başarı mesajı gösterebiliriz
        console.log('Payment successful!');
      }
    }
  }, []);
  
  // Check authentication
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/login');
      return;
    }
    
    // Load user data
    if (isLoaded && isSignedIn && user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.primaryEmailAddress?.emailAddress || '',
        phone: user.phoneNumbers?.[0]?.phoneNumber || '',
        bio: '',
        notifications: {
          email: true,
          browser: false
        }
      });
      
      // Get subscription info
      try {
        console.log('Checking subscription data for user:', user.id);
        
        // any tipini kullanmak zorundayız çünkü Clerk tiplerindeki privateMetadata'yı
        // doğrudan erişemiyoruz
        const privateMetadata = (user as any).privateMetadata;
        const publicMetadata = (user as any).publicMetadata;
        
        // Önce privateMetadata'daki abonelik bilgilerini kontrol et 
        const subData = privateMetadata?.subscription || publicMetadata?.subscription;
        
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
        } else {
          // Abonelik yoksa veya aktif değilse
          setSubscription({
            plan: 'Free Plan',
            status: 'Free',
            renewalDate: null
          });
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
      }
      
      setLoading(false);
    }
  }, [user, isLoaded, isSignedIn, router]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [name]: checked
      }
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    
    try {
      // Update user profile using Clerk or your API
      if (user) {
        await user.update({
          firstName: formData.firstName,
          lastName: formData.lastName
        });
        
        // Handle other profile updates through your own API if needed
        // For example: bio, notification preferences, etc.
        
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(null), 3000);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };
  
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
              </>
    );
  }
  
  return (
    <>
      <Navbar />
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              {/* Profile Header */}
              <div className="px-6 py-8 border-b border-gray-200 bg-gradient-to-r from-primary-500 to-primary-600">
                <div className="flex items-center space-x-4">
                  <div className="h-20 w-20 rounded-full bg-white flex items-center justify-center text-primary-600 text-2xl font-bold border-4 border-white">
                    {user?.firstName?.charAt(0) || user?.lastName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">
                      {user?.firstName} {user?.lastName}
                    </h1>
                    <p className="text-primary-100">
                      Member since {new Date(user?.createdAt || Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Tab Navigation */}
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('personal')}
                    className={`py-4 px-6 text-sm font-medium ${
                      activeTab === 'personal'
                        ? 'border-b-2 border-primary-500 text-primary-600'
                        : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Personal Information
                  </button>
                  <button
                    onClick={() => setActiveTab('subscription')}
                    className={`py-4 px-6 text-sm font-medium ${
                      activeTab === 'subscription'
                        ? 'border-b-2 border-primary-500 text-primary-600'
                        : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Subscription
                  </button>
                  <button
                    onClick={() => setActiveTab('security')}
                    className={`py-4 px-6 text-sm font-medium ${
                      activeTab === 'security'
                        ? 'border-b-2 border-primary-500 text-primary-600'
                        : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Security
                  </button>
                </nav>
              </div>
              
              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'personal' && (
                  <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                          First Name
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          id="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`mt-1 block w-full rounded-md ${
                            isEditing ? 'border-gray-300' : 'border-gray-200 bg-gray-50'
                          } shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm`}
                        />
                      </div>
                      <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                          Last Name
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          id="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`mt-1 block w-full rounded-md ${
                            isEditing ? 'border-gray-300' : 'border-gray-200 bg-gray-50'
                          } shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm`}
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          Email Address
                        </label>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          value={formData.email}
                          disabled
                          className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          To change your email, please go to account settings
                        </p>
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          id="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`mt-1 block w-full rounded-md ${
                            isEditing ? 'border-gray-300' : 'border-gray-200 bg-gray-50'
                          } shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                          Bio
                        </label>
                        <textarea
                          name="bio"
                          id="bio"
                          rows={4}
                          value={formData.bio}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`mt-1 block w-full rounded-md ${
                            isEditing ? 'border-gray-300' : 'border-gray-200 bg-gray-50'
                          } shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm`}
                        />
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end">
                      {!isEditing ? (
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          Edit Profile
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="mr-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            disabled={saveStatus === 'saving'}
                          >
                            {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
                          </button>
                        </>
                      )}
                    </div>
                    
                    {saveStatus === 'success' && (
                      <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md">
                        Profile successfully updated!
                      </div>
                    )}
                    
                    {saveStatus === 'error' && (
                      <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
                        There was an error updating your profile. Please try again.
                      </div>
                    )}
                  </form>
                )}
                
                {activeTab === 'subscription' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Your Subscription</h3>
                    <div className="mt-5 border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Current Plan</p>
                          <p className="text-xl font-bold text-gray-900">{subscription.plan}</p>
                        </div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          subscription.status === 'Active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {subscription.status}
                        </span>
                      </div>
                      
                      {subscription.renewalDate && (
                        <div className="mt-4 border-t border-gray-100 pt-4">
                          <p className="text-sm font-medium text-gray-500">Renewal Date</p>
                          <p className="text-sm text-gray-900">{subscription.renewalDate}</p>
                        </div>
                      )}
                      
                      <div className="mt-6">
                        <a
                          href="/pricing"
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          {subscription.status === 'Active'
                            ? 'Manage Subscription'
                            : 'Upgrade Plan'}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                
                {activeTab === 'security' && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Security Settings</h3>
                    <div className="mt-5">
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-5 sm:p-6">
                          <h4 className="text-base font-medium text-gray-900">Change Password</h4>
                          <p className="mt-1 text-sm text-gray-500">
                            Update your password for enhanced security
                          </p>
                          <div className="mt-3">
                            <button
                              onClick={() => openUserProfile()}
                              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              Change Password
                            </button>
                          </div>
                        </div>
                        <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
                          <h4 className="text-base font-medium text-gray-900">Two-Factor Authentication</h4>
                          <p className="mt-1 text-sm text-gray-500">
                            Add an extra layer of security to your account
                          </p>
                          <div className="mt-3">
                            <button
                              onClick={() => openUserProfile()}
                              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                            >
                              Configure 2FA
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
} 