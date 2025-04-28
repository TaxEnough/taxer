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

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
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
            const planType = subData.priceId?.includes('basic') ? 'Basic' : 'Premium';
            
            // Yenileme tarihini formatla
            const renewalDate = subData.currentPeriodEnd ? 
              new Date(subData.currentPeriodEnd).toLocaleDateString() : '-';
            
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
    console.log('ProfilePage useEffect çalıştı, loading:', loading, 'user:', user, 'forceRemain:', forceRemain);
    
    // Eğer forceRemain aktifse, her durumda sayfada kal
    if (forceRemain) {
      console.log('Force remain aktif, sayfada kalınıyor');
      
      // Token kontrolü
      const token = getAuthTokenFromClient();
      if (token) {
        console.log('Token bulundu, profil bilgileri yükleniyor');
        
        // Eğer user bilgisi yoksa API'den almaya çalış
        if (!user) {
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
          setName(user.name || user.email?.split('@')[0] || 'Kullanıcı');
          setEmail(user.email || '');
          
          if (user.id) {
            fetchUserSubscription(user.id);
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
        if (!user) {
          console.log('Yükleme tamamlandı, kullanıcı yok, login sayfasına yönlendiriliyor');
          router.push('/login');
        } else {
          console.log('Yükleme tamamlandı, kullanıcı var');
          setName(user.name || user.email?.split('@')[0] || 'Kullanıcı');
          setEmail(user.email || '');
          
          if (user.id) {
            fetchUserSubscription(user.id);
          }
          
          setPageLoading(false);
        }
      }
    }
  }, [loading, user, router, forceRemain]);

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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Manage your personal information and account settings here.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700">{name}</p>
                  <p className="text-xs text-gray-500">{email}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sekme Menüsü */}
          <div className="border-t border-gray-200">
            <div className="flex border-b">
              <button
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'profile'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('profile')}
              >
                Profile Information
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'password'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('password')}
              >
                Change Password
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'account'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('account')}
              >
                Account Management
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'subscription'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('subscription')}
              >
                Subscription
              </button>
            </div>
            
            {/* Sekme İçeriği */}
            <div className="p-6">
              {activeTab === 'profile' && (
                <ProfileForm />
              )}
              
              {activeTab === 'password' && (
                <ChangePasswordForm />
              )}
              
              {activeTab === 'account' && (
                <div>
                  <h2 className="text-lg font-medium mb-6">Account Management</h2>
                  
                  <div className="mb-8">
                    <h3 className="text-md font-medium mb-4">Account Summary</h3>
                    <div className="bg-gray-50 p-4 rounded-md">
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Total Transactions</dt>
                          <dd className="mt-1 text-sm text-gray-900">{accountSummary.totalTransactions}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Total Investment</dt>
                          <dd className="mt-1 text-sm text-gray-900">{accountSummary.totalInvestment}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Total Tax Calculated</dt>
                          <dd className="mt-1 text-sm text-gray-900">{accountSummary.totalTaxCalculated}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Last Calculation Date</dt>
                          <dd className="mt-1 text-sm text-gray-900">{accountSummary.lastCalculationDate}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  
                  <div className="mt-10">
                    <h3 className="text-md font-medium mb-4 text-red-600">Danger Zone</h3>
                    <DeleteAccountForm />
                  </div>
                </div>
              )}
              
              {activeTab === 'subscription' && (
                <div>
                  <h2 className="text-lg font-medium mb-6">Subscription</h2>
                  
                  {isLoadingSubscription ? (
                    <div className="flex justify-center py-6">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-6">
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Current Plan</dt>
                          <dd className="mt-1 text-sm">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              subscriptionData.plan === 'Free Plan' 
                                ? 'bg-gray-100 text-gray-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {subscriptionData.plan}
                            </span>
                          </dd>
                        </div>
                        {subscriptionData.status === 'Active' && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Renewal Date</dt>
                            <dd className="mt-1 text-sm text-gray-900">{subscriptionData.renewalDate}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}
                  
                  {subscriptionData.status === 'Active' && (
                    <div className="mt-6 flex space-x-4">
                      <button 
                        onClick={() => router.push('/pricing')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Change Plan
                      </button>
                      <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                        Cancel Subscription
                      </button>
                    </div>
                  )}
                  
                  {subscriptionData.status !== 'Active' && (
                    <div className="mt-6">
                      <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 mb-6">
                        <h3 className="text-lg font-semibold text-blue-800 mb-3">Upgrade to Premium Features!</h3>
                        <p className="text-sm text-gray-700 mb-4">
                          Enhance your investment tracking experience with our premium plans. Unlock advanced features including:
                        </p>
                        <ul className="space-y-2 mb-6">
                          <li className="flex items-center">
                            <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm font-medium">Unlimited tax calculations</span>
                          </li>
                          <li className="flex items-center">
                            <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm font-medium">Advanced portfolio analytics</span>
                          </li>
                          <li className="flex items-center">
                            <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm font-medium">Personalized tax optimization strategies</span>
                          </li>
                          <li className="flex items-center">
                            <svg className="h-5 w-5 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm font-medium">Priority customer support</span>
                          </li>
                        </ul>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="text-sm font-semibold text-gray-900">Starting at just $19.99/month</span>
                            <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Save 20%</span>
                          </div>
                          <button 
                            onClick={() => router.push('/pricing')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                          >
                            View Plans
                          </button>
                        </div>
                      </div>
                      <button 
                        onClick={() => router.push('/pricing')}
                        className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium text-center"
                      >
                        Upgrade Now
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
} 