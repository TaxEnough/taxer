'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { getUserSubscription } from '@/lib/clerkStripeIntegration';

export default function ProfileForm() {
  const { user } = useAuth(); // Backward compatibility for AuthContext
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser(); // Clerk user
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [subscriptionStatus, setSubscriptionStatus] = useState('Free Plan');
  const [debugInfo, setDebugInfo] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Debug bilgisi
    console.log('ProfileForm - Auth Context User:', user);
    console.log('ProfileForm - Clerk User:', clerkUser);
    
    // Öncelikle Clerk kullanıcısını kontrol et
    if (clerkLoaded && isSignedIn && clerkUser) {
      const fullName = clerkUser.fullName || 
                       `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
      
      setName(fullName || user?.name || '');
      
      // Clerk'ten e-posta al
      const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress;
      setEmail(primaryEmail || user?.email || '');
      
      // Debug için bilgiyi ayarla
      const debugText = `User ID: ${clerkUser.id || user?.id || 'Missing'}\n` +
                        `Name: ${fullName || 'Missing'}\n` +
                        `Email: ${primaryEmail || 'Missing'}\n`;
      setDebugInfo(debugText);
      
      // Abonelik durumunu kontrol et
      const checkSubscription = async () => {
        try {
          const subscription = await getUserSubscription(clerkUser.id);
          
          if (subscription.status === 'active') {
            setSubscriptionStatus(subscription.planType === 'premium' ? 'Premium' : 'Basic');
          } else {
            setSubscriptionStatus('Free Plan');
          }
        } catch (error) {
          console.error('Abonelik durumu kontrol edilirken hata oluştu:', error);
          setSubscriptionStatus('Free Plan');
        }
      };
      
      checkSubscription();
    } 
    // Eğer Clerk kullanıcısı yoksa, fallback olarak AuthContext kullanıcısına bak
    else if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      
      const debugText = `User ID: ${user.id || 'Missing'}\n` +
                        `Name: ${user.name || 'Missing'}\n` +
                        `Email: ${user.email || 'Missing'}\n`;
      setDebugInfo(debugText);
      
      // Subscription bilgisi yok, default free plan göster
      setSubscriptionStatus('Free Plan');
    }
  }, [user, clerkUser, clerkLoaded, isSignedIn]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setMessage({ text: 'Name cannot be empty', type: 'error' });
      return;
    }
    
    setIsSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      // Clerk kullanıcısını kontrol et ve güncelle
      if (clerkLoaded && isSignedIn && clerkUser) {
        // Clerk API ile isim güncelleme
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        
        await clerkUser.update({
          firstName,
          lastName
        });
        
        setMessage({ text: 'Profile updated successfully', type: 'success' });
        setIsEditing(false);
      } 
      // Eğer Clerk kullanıcısı yoksa hata ver
      else {
        setMessage({ text: 'Your session may have expired. Please log in again.', type: 'error' });
        setTimeout(() => {
          router.push('/login');
        }, 2000);
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
            
            <div className="flex space-x-3">
              <button 
                type="submit" 
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button 
                type="button" 
                className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-medium text-gray-900">Account Information</h3>
            {debugInfo && process.env.NODE_ENV === 'development' && (
              <div className="my-2 p-2 bg-gray-100 rounded text-xs font-mono whitespace-pre-wrap">
                {debugInfo}
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500">Full Name</p>
              <p className="mt-1 text-sm text-gray-900">{name || 'Not provided'}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">Email Address</p>
              <p className="mt-1 text-sm text-gray-900">{email || 'Not provided'}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-500">Subscription</p>
              <p className="mt-1 text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  subscriptionStatus === 'Premium' 
                    ? 'bg-green-100 text-green-800' 
                    : subscriptionStatus === 'Basic' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-800'
                }`}>
                  {subscriptionStatus}
                </span>
              </p>
            </div>
          </div>
          
          <div>
            <button 
              type="button" 
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              onClick={() => setIsEditing(true)}
            >
              Edit Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 