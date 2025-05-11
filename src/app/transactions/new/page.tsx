'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getAuthTokenFromClient } from '@/lib/auth-client';
import ClientToastWrapper, { useClientToast } from '@/components/ui/client-toast';

export default function NewTransaction() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { toast } = useClientToast();
  
  // Form state
  const [formData, setFormData] = useState({
    stock: '',
    buyDate: '',
    buyPrice: '',
    sellDate: '',
    sellPrice: '',
    quantity: '',
    tradingFees: '0',
    note: ''
  });
  
  // Form değişikliği işleme
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Sayısal alanlar için kontrol
    if (name === 'buyPrice' || name === 'sellPrice' || name === 'quantity' || name === 'tradingFees') {
      // Sayısal değeri temizle ve kontrol et
      const numValue = value.replace(/[^0-9.]/g, '');
      // Noktadan sonra en fazla 2 basamak olmalı
      const parts = numValue.split('.');
      
      if (parts.length > 1) {
        parts[1] = parts[1].substring(0, 2);
        setFormData({ ...formData, [name]: parts.join('.') });
      } else {
        setFormData({ ...formData, [name]: numValue });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  
  // Form gönderimi
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      // Token'ı al
      const token = getAuthTokenFromClient();
      
      if (!token) {
        setError('Your session may have expired. Please login again.');
        setLoading(false);
        return;
      }
      
      // API'ye veri gönder
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'An error occurred while adding the transaction');
      }
      
      // Başarılı
      setSuccess(true);
      setFormData({
        stock: '',
        buyDate: '',
        buyPrice: '',
        sellDate: '',
        sellPrice: '',
        quantity: '',
        tradingFees: '0',
        note: ''
      });
      
      if (typeof toast === 'function') {
        toast({
          title: 'Success',
          description: 'Transaction added successfully.',
        });
      }
      
      // 2 saniye sonra işlemler sayfasına yönlendir
      setTimeout(() => {
        router.push('/transactions');
      }, 2000);
      
    } catch (err: any) {
      console.error('Error adding transaction:', err);
      setError(err.message || 'Transaction could not be added. Please try again later.');
      
      if (typeof toast === 'function') {
        toast({
          title: 'Error',
          description: err.message || 'Transaction could not be added. Please try again later.',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <ClientToastWrapper>
      <Navbar />
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900">New Transaction</h1>
            <a href="/transactions" className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
              Go Back
            </a>
          </div>
        </header>
        
        <main>
          <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
            {error && (
              <div className="mb-4 bg-red-50 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {success && (
              <div className="mb-4 bg-green-50 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Success</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>Transaction added successfully. Redirecting to transactions page...</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="stock" className="block text-sm font-medium text-gray-700">
                        Stock Symbol
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="stock"
                          id="stock"
                          required
                          placeholder="AAPL"
                          value={formData.stock}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                        Quantity
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="quantity"
                          id="quantity"
                          required
                          placeholder="10"
                          value={formData.quantity}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="buyDate" className="block text-sm font-medium text-gray-700">
                        Purchase Date
                      </label>
                      <div className="mt-1">
                        <input
                          type="date"
                          name="buyDate"
                          id="buyDate"
                          required
                          value={formData.buyDate}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="buyPrice" className="block text-sm font-medium text-gray-700">
                        Purchase Price ($)
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="buyPrice"
                          id="buyPrice"
                          required
                          placeholder="150.00"
                          value={formData.buyPrice}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="sellDate" className="block text-sm font-medium text-gray-700">
                        Sale Date
                      </label>
                      <div className="mt-1">
                        <input
                          type="date"
                          name="sellDate"
                          id="sellDate"
                          required
                          value={formData.sellDate}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="sellPrice" className="block text-sm font-medium text-gray-700">
                        Sale Price ($)
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="sellPrice"
                          id="sellPrice"
                          required
                          placeholder="180.00"
                          value={formData.sellPrice}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="tradingFees" className="block text-sm font-medium text-gray-700">
                        Trading Fee ($)
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="tradingFees"
                          id="tradingFees"
                          placeholder="0.00"
                          value={formData.tradingFees}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-6">
                      <label htmlFor="note" className="block text-sm font-medium text-gray-700">
                        Note (Optional)
                      </label>
                      <div className="mt-1">
                        <textarea
                          name="note"
                          id="note"
                          rows={3}
                          placeholder="Notes about the transaction..."
                          value={formData.note}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end">
                    <a
                      href="/transactions"
                      className="mr-3 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Cancel
                    </a>
                    <button
                      type="submit"
                      disabled={loading}
                      className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        'Save'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </ClientToastWrapper>
  );
} 