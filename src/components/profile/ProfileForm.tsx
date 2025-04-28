'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function ProfileForm() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [subscriptionStatus, setSubscriptionStatus] = useState('Free Plan');
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    // Debug bilgisi
    console.log('ProfileForm - Auth Context User:', user);
    
    if (user) {
      setName(user.name || '');
      // Eğer context'ten alınan e-posta yoksa veya boşsa Firestore'dan doğrudan almayı deneyelim
      setEmail(user.email || '');
      
      // Debug için bilgiyi ayarla
      const debugText = `User ID: ${user.id || 'Missing'}\nName: ${user.name || 'Missing'}\nEmail: ${user.email || 'Missing'}\n`;
      setDebugInfo(debugText);
      
      // E-posta alanı boşsa, direkt Firestore'dan almayı dene
      if (!user.email) {
        console.log('Email not found in AuthContext, trying to get directly from Firestore');
        getEmailFromFirestore(user.id);
      }
      
      // Abonelik durumunu kontrol et
      const checkSubscription = async () => {
        try {
          const userRef = doc(db, 'users', user.id);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            
            // Eğer email hala boşsa ve Firestore'da varsa
            if (!email && userData.email) {
              console.log('Setting email from Firestore:', userData.email);
              setEmail(userData.email);
              setDebugInfo(prev => prev + `\nFirestore Email: ${userData.email}`);
            }
            
            if (userData.subscriptionStatus === 'active' && userData.subscriptionId) {
              const subscriptionRef = doc(db, 'subscriptions', userData.subscriptionId);
              const subscriptionSnap = await getDoc(subscriptionRef);
              
              if (subscriptionSnap.exists()) {
                const subData = subscriptionSnap.data();
                const planType = subData.priceId?.includes('basic') ? 'Basic' : 'Premium';
                setSubscriptionStatus(planType);
              } else {
                setSubscriptionStatus('Free Plan');
              }
            } else {
              setSubscriptionStatus('Free Plan');
            }
          }
        } catch (error) {
          console.error('Abonelik durumu kontrol edilirken hata oluştu:', error);
          setSubscriptionStatus('Free Plan');
        }
      };
      
      checkSubscription();
    }
  }, [user]);
  
  // Direkt olarak Firestore'dan email verisini al
  const getEmailFromFirestore = async (userId: string) => {
    if (!userId) return;
    
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        
        if (userData.email) {
          console.log('Email found in Firestore:', userData.email);
          setEmail(userData.email);
          setDebugInfo(prev => prev + `\nFirestore email found: ${userData.email}`);
        } else {
          console.log('No email found in Firestore document');
          setDebugInfo(prev => prev + '\nNo email in Firestore document');
        }
      } else {
        console.log('User document not found in Firestore');
        setDebugInfo(prev => prev + '\nUser document not found in Firestore');
      }
    } catch (error) {
      console.error('Error getting email from Firestore:', error);
      setDebugInfo(prev => prev + '\nError getting email from Firestore');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    setIsSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      const response = await fetch('/api/user/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      
      const data = await response.json();
      
      // API işlemi başarılı mı?
      if (response.ok) {
        setMessage({ text: 'Profile updated successfully', type: 'success' });
        setIsEditing(false);
      } 
      // Client tarafında işlem yapılması gerekiyor mu?
      else if (response.status === 202 && data.shouldUseClientSide) {
        console.log('Client-side profil güncelleme işlemi yapılıyor');
        
        // Firebase Auth kullanıcısını kontrol et
        if (!auth.currentUser) {
          setMessage({ 
            text: 'Your session may have expired. Please log in again.', 
            type: 'error' 
          });
          return;
        }
        
        try {
          // Firebase Auth'taki kullanıcı görünen adını güncelle
          await updateProfile(auth.currentUser, {
            displayName: name
          });
          
          // Güncellenmiş kullanıcı adını AuthContext'i güncelle
          // Burada doğrudan context'i güncelleyecek bir fonksiyon olmadığından,
          // Sayfayı yenilemek en iyi çözüm olabilir
          
          setMessage({ text: 'Profile updated successfully (client-side)', type: 'success' });
          setIsEditing(false);
          
          // Kullanıcı bilgisini yenilemek için sayfayı 2 saniye sonra yenileyelim
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } catch (clientError: any) {
          console.error('Client-side profil güncelleme hatası:', clientError);
          setMessage({ 
            text: 'An error occurred while updating the profile: ' + (clientError.message || 'Unknown error'), 
            type: 'error' 
          });
        }
      } else {
        throw new Error(data.error || 'An error occurred while updating the profile');
      }
    } catch (error: any) {
      console.error('Profil güncelleme hatası:', error);
      setMessage({ 
        text: error.message || 'An error occurred while updating the profile', 
        type: 'error' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {message.text && (
        <div className={`mb-6 p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}
      
      {isEditing ? (
        <form onSubmit={handleSaveProfile}>
          <div className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  disabled
                  className="shadow-sm bg-gray-50 block w-full sm:text-sm border-gray-300 rounded-md"
                />
                <p className="mt-1 text-sm text-gray-500">Email address cannot be changed.</p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setName(user?.name || '');
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium text-gray-900">Personal Information</h2>
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Edit
            </button>
          </div>
          
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Full Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{user?.name || 'Not specified'}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Email Address</dt>
              <dd className="mt-1 text-sm text-gray-900">{email || user?.email || 'Not available'}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Account ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{user?.id || 'Not available'}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Account Status</dt>
              <dd className="mt-1 text-sm">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  subscriptionStatus === 'Free Plan' 
                    ? 'bg-gray-100 text-gray-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {subscriptionStatus}
                </span>
              </dd>
            </div>
          </dl>
          
          {/* Debug bilgileri - yalnızca test için */}
          {debugInfo && process.env.NODE_ENV !== 'production' && (
            <div className="mt-6 p-3 bg-gray-100 rounded-md text-xs font-mono whitespace-pre-wrap opacity-70">
              {debugInfo}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 