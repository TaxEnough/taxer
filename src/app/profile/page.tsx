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
import { auth } from '@/lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [forceRemain, setForceRemain] = useState(false);

  // Örnek hesap özeti verileri
  const accountSummary = {
    totalTransactions: 24,
    totalInvestment: '12,500 USD',
    totalTaxCalculated: '1,875 USD',
    lastCalculationDate: '15.03.2023'
  };

  // Örnek abonelik bilgileri
  const subscription = {
    plan: 'Standart',
    status: 'Active',
    renewalDate: '15.06.2023',
    price: '$9.99/month'
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
                  
                  <div className="bg-gray-50 p-4 rounded-md">
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Current Plan</dt>
                        <dd className="mt-1 text-sm text-gray-900">{subscription.plan}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Status</dt>
                        <dd className="mt-1 text-sm text-gray-900">{subscription.status}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Renewal Date</dt>
                        <dd className="mt-1 text-sm text-gray-900">{subscription.renewalDate}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Price</dt>
                        <dd className="mt-1 text-sm text-gray-900">{subscription.price}</dd>
                      </div>
                    </dl>
                  </div>
                  
                  <div className="mt-6 flex space-x-4">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                      Change Plan
                    </button>
                    <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                      Cancel Subscription
                    </button>
                  </div>
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