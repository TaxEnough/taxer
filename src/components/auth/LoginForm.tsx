'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setAuthTokenInClient } from '@/lib/auth-client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Başarılı girişten sonra yönlendirme
  useEffect(() => {
    if (success) {
      // Hızlı yönlendirme için daha kısa bir süre kullanıyoruz
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    
    // Validate form data
    if (!email || !password) {
      setError('Lütfen email ve şifre girin');
      return;
    }
    
    setLoading(true);
    
    try {
      // Send request to API - cache'leme devre dışı
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache', // Cache kontrolü
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
        cache: 'no-store'
      });
      
      // Yanıtı JSON'a dönüştürmeye çalış
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Sunucu yanıtı geçersiz format');
      }
      
      // Yanıt tamam mı kontrol et
      if (!response.ok) {
        const errorMsg = data.error || data.message || 'Giriş başarısız';
        throw new Error(errorMsg);
      }
      
      // Kullanıcı verileri doğru mu kontrol et
      if (!data.user || !data.token) {
        throw new Error('Eksik sunucu yanıtı');
      }
      
      // Token'ı kaydet - sadece bir kez yap
      try {
        // Client auth lib ile ayarla - bu birden fazla yere kaydeder
        setAuthTokenInClient(data.token);
        
        // User bilgisini kaydet
        localStorage.setItem('user-info', JSON.stringify(data.user));
        localStorage.setItem('isLoggedIn', 'true');
        
        // Giriş başarılı
        setSuccess(true);
        
        // İşlem tamamlandı
        setLoading(false);
        
        // Dashboard'a yönlendir - but through the router.push in the useEffect
      } catch (storageError) {
        console.error('Storage error:', storageError);
        throw new Error('Oturum bilgileri kaydedilemedi');
      }
    } catch (error: any) {
      setError(error.message || 'Giriş başarısız');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Giriş</h2>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
          <p className="text-green-700">Giriş başarılı! Yönlendiriliyor...</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-2">
            E-posta Adresi
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
            Şifre
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
                Giriş yapılıyor...
              </>
            ) : success ? (
              'Yönlendiriliyor...'
            ) : (
              'Giriş Yap'
            )}
          </button>
        </div>
      </form>
      
      <p className="mt-4 text-center text-sm text-gray-600">
        Hesabınız yok mu?{' '}
        <a href="/register" className="text-primary-600 hover:text-primary-800">
          Kaydol
        </a>
      </p>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-center text-xs text-gray-500">
          Giriş yaparken <a href="/privacy" className="text-primary-600 hover:text-primary-800">Gizlilik Politikası</a> ve <a href="/terms" className="text-primary-600 hover:text-primary-800">Kullanım Koşullarını</a> kabul etmiş olursunuz.
        </p>
      </div>
    </div>
  );
} 