'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setAuthTokenInClient } from '@/lib/auth-client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debug, setDebug] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Handle direct navigation after login
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDebug('');
    setSuccess(false);
    
    // Validate form data
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    
    setLoading(true);
    setDebug('İstek gönderiliyor...');
    
    try {
      // Send request to API
      setDebug('İstek hazırlanıyor...');
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Önemli: Cookie'lerin gönderilmesini ve alınmasını sağlar
      });
      
      setDebug(prev => prev + '\nAPI yanıtı alındı: ' + response.status);
      
      // Yanıtı JSON'a dönüştürmeye çalış
      let data;
      try {
        data = await response.json();
        setDebug(prev => prev + '\nYanıt başarıyla JSON\'a dönüştürüldü');
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        setDebug(prev => prev + '\nJSON ayrıştırma hatası: ' + jsonError);
        throw new Error('Invalid server response format');
      }
      
      // Yanıt tamam mı kontrol et
      if (!response.ok) {
        const errorMsg = data.error || data.message || 'Login failed';
        setDebug(prev => prev + '\nHata yanıtı: ' + errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log('Login successful:', data);
      setDebug(prev => prev + '\nGiriş başarılı, veri alındı');
      
      // Kullanıcı verileri doğru mu kontrol et
      if (!data.user || !data.token) {
        setDebug(prev => prev + '\nEksik yanıt verileri! Kullanıcı veya token yok.');
        throw new Error('Incomplete server response');
      }
      
      // Token'ı kaydet
      setDebug(prev => prev + '\nToken kaydediliyor...');
      
      // Set the token from the API on the client side
      if (data.token) {
        console.log('Setting token on client side');
        
        try {
          // Doğrudan document.cookie ile ayarla
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 7); // 7 gün
          document.cookie = `auth-token=${data.token}; path=/; expires=${expiryDate.toUTCString()}`;
          setDebug(prev => prev + '\nToken cookie olarak ayarlandı');
        } catch (cookieError) {
          console.error('Cookie set error:', cookieError);
          setDebug(prev => prev + '\nCookie ayarlama hatası: ' + cookieError);
        }
        
        try {
          // localStorage ile kaydet
          localStorage.setItem('auth-token', data.token);
          localStorage.setItem('user-info', JSON.stringify(data.user));
          localStorage.setItem('isLoggedIn', 'true');
          setDebug(prev => prev + '\nToken localStorage\'a kaydedildi');
        } catch (storageError) {
          console.error('localStorage error:', storageError);
          setDebug(prev => prev + '\nLocalStorage hatası: ' + storageError);
        }
        
        try {
          // Client auth lib ile ayarla
          setAuthTokenInClient(data.token);
          setDebug(prev => prev + '\nToken client auth kütüphanesi ile ayarlandı');
        } catch (clientAuthError) {
          console.error('Client auth error:', clientAuthError);
          setDebug(prev => prev + '\nClient auth hatası: ' + clientAuthError);
        }
      }
      
      // Check for token in different places
      setTimeout(() => {
        try {
          // Cookie kontrolü
          const cookies = document.cookie.split(';');
          const authCookie = cookies.find(c => c.trim().startsWith('auth-token='));
          
          // localStorage kontrolü
          const lsToken = localStorage.getItem('auth-token');
          
          setDebug(prev => prev + 
            '\n\nToken kontrol:' + 
            '\n- Cookie: ' + (authCookie ? 'BULUNDU ✓' : 'YOK ✗') + 
            '\n- LocalStorage: ' + (lsToken ? 'BULUNDU ✓' : 'YOK ✗')
          );
          
          // Her şey yolunda
          if (authCookie || lsToken) {
            setSuccess(true);
            setDebug(prev => prev + '\n\nGiriş başarılı! Yönlendiriliyor...');
          } else {
            setError('Login successful but session storage failed. Please try refreshing the page.');
            setLoading(false);
          }
        } catch (checkError) {
          console.error('Token check error:', checkError);
          setDebug(prev => prev + '\nToken kontrol hatası: ' + checkError);
          setError('An error occurred during login. Please try again.');
          setLoading(false);
        }
      }, 1000);
      
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed');
      setDebug(prev => prev + '\nHata: ' + (error.message || 'Bilinmeyen hata'));
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Login</h2>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
          <p className="text-green-700">Login successful! Redirecting...</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-2">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            required
            disabled={loading || success}
          />
        </div>
        
        <div className="mb-6">
          <label htmlFor="password" className="block text-gray-700 text-sm font-medium mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            required
            disabled={loading || success}
          />
        </div>
        
        <div>
          <button
            type="submit"
            disabled={loading || success}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Logging in...
              </>
            ) : success ? (
              'Redirecting...'
            ) : (
              'Login'
            )}
          </button>
        </div>
      </form>
      
      <p className="mt-4 text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <a href="/register" className="text-primary-600 hover:text-primary-800">
          Register
        </a>
      </p>
      
      {debug && (
        <div className="mt-4 border border-gray-300 p-3 rounded text-xs text-gray-600 whitespace-pre-wrap">
          <p className="font-bold mb-1">Debug Info:</p>
          {debug}
        </div>
      )}
    </div>
  );
} 