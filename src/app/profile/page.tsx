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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Sayfadaki query parametrelerini kontrol et
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      const emailParam = params.get('email');
      const userIdParam = params.get('userId');
      
      // Email parametresi varsa kontrol edelim
      if (emailParam && (status === 'success')) {
        console.log('Ödeme sonrası URL email parametresi:', emailParam);
        
        // Abonelik yükleniyor işaretini açalım
        setLoading(true);
        
        // 10 saniye bekleyelim (webhook işlemesi için)
        setTimeout(() => {
          console.log('Webhook işlemi için beklendi, abonelik bilgileri tekrar kontrol ediliyor');
          // Abonelik bilgilerini tekrar kontrol edelim (şimdi veya biraz daha bekleyerek)
          setLoading(false);
        }, 10000);
      }
      
      // URL'de başarı durumu var mı kontrol et
      if (status === 'success') {
        setSuccess(true);
      }
    }
  }, []);
  
  useEffect(() => {
    if (isLoaded && user) {
      try {
        console.log('Checking subscription data for user:', user.id);
        
        // Clerk metadatasını kontrol edelim - hem public hem private
        console.log('Public metadata:', user.publicMetadata);
        console.log('User object:', user);
        
        // any tipini kullanmak zorundayız çünkü Clerk tiplerindeki privateMetadata'yı
        // doğrudan erişemiyoruz
        const privateMetadata = (user as any).privateMetadata;
        const publicMetadata = (user as any).publicMetadata;
        
        console.log('Private Metadata:', privateMetadata);
        console.log('Public Metadata:', publicMetadata);
        
        // Önce privateMetadata'daki abonelik bilgilerini kontrol et 
        const subData = privateMetadata?.subscription || publicMetadata?.subscription;
        
        console.log('Subscription data:', subData);
        
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
        setError('Abonelik bilgileri alınamadı. Lütfen daha sonra tekrar deneyin.');
      } finally {
        setLoading(false);
      }
    } else if (isLoaded && !user) {
      setError('Kullanıcı bilgileri bulunamadı.');
      setLoading(false);
    } else {
      // İstemci tarafı henüz yüklenmiyorsa beklemeye devam et
    }
  }, [isLoaded, user]);
  
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
        <strong className="font-bold">Hata! </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }
  
  return (
    <div>
      {/* Başarı mesajı */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 relative">
          <strong className="font-bold">Başarılı! </strong>
          <span className="block sm:inline">Aboneliğiniz başarıyla oluşturuldu. Abonelik bilgilerinizi birkaç dakika içinde göreceksiniz.</span>
        </div>
      )}

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
  const [error, setError] = useState('');

  // URL'den query parametrelerini kontrol et
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const status = params.get('status');

      // URL'den gelen sekme parametresi varsa o sekmeyi aktif et
      if (tab === 'subscription' || tab === 'profile' || tab === 'security') {
        setActiveTab(tab);
      }
      
      // Ödeme başarılı olduysa bir başarı mesajı gösterebiliriz
      if (status === 'success') {
        // Burada başarı mesajı gösterebiliriz
        console.log('Payment successful!');
      }
    }
  }, []);

  // Kullanıcı oturum açmadıysa veya veri yüklenemiyorsa, ana sayfaya yönlendirme
  useEffect(() => {
    if (isLoaded) {
      if (!clerkUser) {
        router.push('/');
      } else {
        setPageLoading(false);
        
        // Clerk kullanıcı ID'si ile kontrol
        if ((clerkUser as any).id) {
          console.log('Clerk User ID:', (clerkUser as any).id);
        } else {
          setError('Kullanıcı bilgileri alınamadı.');
        }
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
          
          {/* Hata mesajı varsa göster */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              <strong className="font-bold">Hata!</strong>
              <span className="block sm:inline"> {error}</span>
            </div>
          )}
          
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