'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ChangePasswordForm() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Component yüklendiğinde, kullanıcının e-posta adresini form'a doldur
  useEffect(() => {
    if (user && user.email) {
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // E-posta kontrolü
    if (!email) {
      setError('You must enter an email address');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // API üzerinden şifre sıfırlama isteği gönder
      console.log('Şifre sıfırlama isteği gönderiliyor:', email);
      
      const response = await fetch('/api/user/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Password reset failed');
      }
      
      console.log('Şifre sıfırlama isteği başarılı:', data);
      setSuccess(data.message || 'Password reset link has been sent to your email address. Please check your email.');
    } catch (error: any) {
      console.error('Şifre sıfırlama hatası:', error);
      setError(error.message || 'An error occurred during the password reset process');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium mb-6">Change Password</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md">
          {success}
        </div>
      )}
      
      <div className="mb-6 p-3 bg-yellow-50 text-yellow-800 rounded-md">
        <p>To change your password, we will send a reset link to your email address.</p>
        <p className="mt-2">You can set your new password by clicking on the link in the email.</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label htmlFor="email" className="block text-gray-700 mb-2">
            Your Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 px-4 rounded-md text-white font-medium ${
            loading
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Sending...' : 'Send Password Reset Link'}
        </button>
      </form>
    </div>
  );
} 