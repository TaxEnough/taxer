'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getAuthTokenFromClient } from '@/lib/auth-client';
import ProfileForm from '@/components/profile/ProfileForm';
import ChangePasswordForm from '@/components/profile/ChangePasswordForm';
import DeleteAccountForm from '@/components/profile/DeleteAccountForm';
import { deleteUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import SubscriptionInfo from '@/components/profile/SubscriptionInfo';
import { useUser } from '@clerk/nextjs';

export default function ProfilePage() {
  const { user: firebaseUser, loading, logout } = useAuth();
  const router = useRouter();
  const { user: clerkUser, isLoaded } = useUser();
  const [pageLoading, setPageLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [forceRemain, setForceRemain] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState({
    plan: 'Free Plan',
    status: 'Free',
    renewalDate: '-'
  });
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);

  // Varsayılan hesap özeti verileri (hepsi 0)
  const accountSummary = {
    totalTransactions: 0,
    totalInvestment: '0 USD',
    totalTaxCalculated: '0 USD',
    lastCalculationDate: '-'
  };

  // Middleware'i devre dışı bırakmak için URL'de özel parametre kontrolü
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('direct')) {
        setForceRemain(true);
        // URL'den parametreyi temizle
        url.searchParams.delete('direct');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  // Kullanıcının abonelik bilgilerini almak için
  const fetchUserSubscription = async (userId: string) => {
    try {
      setIsLoadingSubscription(true);
      // Kullanıcı belgesini al
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const subscriptionId = userData.subscriptionId;
        const subscriptionStatus = userData.subscriptionStatus;
        const subscriptionPriceId = userData.subscriptionPriceId;
        
        if (subscriptionId && subscriptionStatus === 'active') {
          // Abonelik bilgilerini al
          const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
          const subscriptionSnap = await getDoc(subscriptionRef);
          
          if (subscriptionSnap.exists()) {
            const subData = subscriptionSnap.data();
            // Basic planın ID'si ile tam eşleşme kontrolü yapıyoruz
            const planType = subData.priceId === 'price_1RIS0fLhWC2oNMWwizDKv78o' ? 'Basic' : 'Premium';
            
            // Yenileme tarihini formatla
            const renewalDate = subData.currentPeriodEnd ? 
              (() => {
                // currentPeriodEnd bir Firestore Timestamp, Date veya epoch ms olabilir
                let date;
                if (subData.currentPeriodEnd.toDate && typeof subData.currentPeriodEnd.toDate === 'function') {
                  // Firestore Timestamp
                  date = subData.currentPeriodEnd.toDate();
                } else if (subData.currentPeriodEnd instanceof Date) {
                  // Date nesnesi
                  date = subData.currentPeriodEnd;
                } else if (typeof subData.currentPeriodEnd === 'number') {
                  // Epoch milliseconds
                  date = new Date(subData.currentPeriodEnd);
                } else {
                  // String veya başka format olabilir
                  try {
                    date = new Date(subData.currentPeriodEnd);
                  } catch (e) {
                    console.error('Geçersiz tarih formatı:', subData.currentPeriodEnd);
                    return '-';
                  }
                }
                
                // Tarih geçerli mi kontrol et
                if (isNaN(date.getTime())) {
                  console.error('Geçersiz tarih:', date);
                  return '-';
                }
                
                // Amerikan tarih formatı kullan
                return date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
              })() : '-';
            
            setSubscriptionData({
              plan: planType,
              status: 'Active',
              renewalDate: renewalDate
            });
          }
        } else {
          // Aktif abonelik yok
          setSubscriptionData({
            plan: 'Free Plan',
            status: 'Free',
            renewalDate: '-'
          });
        }
      }
    } catch (error) {
      console.error('Abonelik bilgileri alınırken hata oluştu:', error);
      setSubscriptionData({
        plan: 'Free Plan',
        status: 'Free',
        renewalDate: '-'
      });
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  useEffect(() => {
    console.log('ProfilePage useEffect çalıştı, loading:', loading, 'user:', firebaseUser, 'forceRemain:', forceRemain);
    
    // Eğer forceRemain aktifse, her durumda sayfada kal
    if (forceRemain) {
      console.log('Force remain aktif, sayfada kalınıyor');
      
      // Token kontrolü
      const token = getAuthTokenFromClient();
      if (token) {
        console.log('Token bulundu, profil bilgileri yükleniyor');
        
        // Eğer user bilgisi yoksa API'den almaya çalış
        if (!firebaseUser) {
          console.log('User bilgisi yok, API\'den yüklemeye çalışılacak');
          
          const fetchUserData = async () => {
            try {
              const response = await fetch('/api/auth/me');
              
              if (response.ok) {
                const data = await response.json();
                console.log('API\'den kullanıcı bilgileri alındı:', data);
                
                setName(data.name || data.email?.split('@')[0] || 'Kullanıcı');
                setEmail(data.email || '');
                
                if (data.id) {
                  fetchUserSubscription(data.id);
                }
              } else {
                console.error('API\'den profil bilgileri alınamadı:', response.status);
                setName('Kullanıcı');
                setEmail('');
              }
            } catch (error) {
              console.error('Profil bilgileri yüklenirken hata:', error);
              setName('Kullanıcı');
              setEmail('');
            } finally {
              setPageLoading(false);
            }
          };
          
          fetchUserData();
        } else {
          console.log('User bilgisi mevcut');
          setName(firebaseUser.name || firebaseUser.email?.split('@')[0] || 'Kullanıcı');
          setEmail(firebaseUser.email || '');
          
          if (firebaseUser.id) {
            fetchUserSubscription(firebaseUser.id);
          }
          
          setPageLoading(false);
        }
      } else {
        console.log('Token bulunamadı, login sayfasına yönlendiriliyor');
        router.push('/login');
      }
    } else {
      console.log('Force remain aktif değil, normal akış devam ediyor');
      
      // Yükleme tamamlandıysa ve kullanıcı yoksa, login sayfasına yönlendir
      if (!loading) {
        if (!firebaseUser) {
          console.log('Yükleme tamamlandı, kullanıcı yok, login sayfasına yönlendiriliyor');
          router.push('/login');
        } else {
          console.log('Yükleme tamamlandı, kullanıcı var');
          setName(firebaseUser.name || firebaseUser.email?.split('@')[0] || 'Kullanıcı');
          setEmail(firebaseUser.email || '');
          
          if (firebaseUser.id) {
            fetchUserSubscription(firebaseUser.id);
          }
          
          setPageLoading(false);
        }
      }
    }
  }, [loading, firebaseUser, router, forceRemain]);

  // Kullanıcı oturum açmadıysa veya veri yüklenemiyorsa, ana sayfaya yönlendirme
  useEffect(() => {
    if (isLoaded && !clerkUser) {
      router.push('/');
    }
  }, [isLoaded, clerkUser, router]);

  if (loading || pageLoading) {
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
                  <SubscriptionInfo />
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
                        onClick={() => clerkUser?.openUserProfile()}
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