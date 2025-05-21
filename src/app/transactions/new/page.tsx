'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Plus, ArrowLeft } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import TransactionDialog from '@/components/transactions/new/TransactionDialog';
import { Transaction } from '@/types/transaction';
import { useClerkAuthCache } from '@/lib/clerk-utils';
import { getAuthTokenFromClient } from '@/lib/auth-client';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

export default function NewTransactionsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const clerkAuth = useClerkAuthCache();
  
  // Dialog state - default açık
  const [dialogOpen, setDialogOpen] = useState(true);
  const [dialogMode] = useState<'add' | 'edit' | 'sell'>('add');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedTicker, setSelectedTicker] = useState('');
  
  // Submit transaction handler
  const handleSubmitTransaction = async (data: Omit<Transaction, 'id'>) => {
    try {
      const token = await getAuthTokenFromClient();
      
      if (!token) {
        throw new Error('Authentication token not available');
      }
      
      // Create new transaction
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
    
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create transaction');
      }
      
      // Başarılı bir şekilde eklendikten sonra işlemler sayfasına yönlendir
      toast.success('Transaction added successfully');
      router.push('/transactions');
    } catch (error: any) {
      console.error('Transaction submission error:', error);
      throw error;
    }
  };
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div>
            <div className="flex items-center mb-2">
              <Link href="/transactions" className="inline-flex items-center text-gray-600 hover:text-gray-900 mr-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
              <h1 className="text-3xl font-bold">Add New Transaction</h1>
            </div>
            <p className="text-gray-500">
              Record a new investment transaction to your portfolio
            </p>
          </div>
        </div>
        
        {/* İçerik - Sadece başlık göster */}
        <div className="bg-white rounded-lg p-6 text-center border border-gray-200">
          <p className="text-gray-600">
            Please use the transaction form to add your investment details.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            If the form is closed, click on "Add New Transaction" button to open it again.
          </p>
          <div className="mt-4">
            <Button 
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-primary-600 border border-transparent rounded-md font-semibold text-xs text-white tracking-widest hover:bg-primary-700 active:bg-primary-800 focus:outline-none focus:border-primary-800 focus:ring ring-primary-300 disabled:opacity-25 transition ease-in-out duration-150"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add New Transaction
            </Button>
          </div>
        </div>
      </div>
      
      {/* Transaction Dialog - hep açık */}
      <TransactionDialog
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          // Dialog kapatıldığında transactions sayfasına geri dön
          router.push('/transactions');
        }}
        onSubmit={handleSubmitTransaction}
        defaultValues={selectedTransaction || undefined}
        mode={dialogMode}
        ticker={selectedTicker}
        availableShares={0}
        averageCost={0}
      />
    </div>
  );
} 