'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Plus, Search, Loader2, ArrowLeft } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StockCard from '@/components/transactions/new/StockCard';
import TransactionDialog from '@/components/transactions/new/TransactionDialog';
import { Transaction } from '@/types/transaction';
import { formatCurrency } from '@/lib/utils';
import { useClerkAuthCache, getQuickPremiumStatus } from '@/lib/clerk-utils';
import { getTransactionsByTicker } from '@/lib/transaction-firebase';
import { getAuthTokenFromClient } from '@/lib/auth-client';
import Link from 'next/link';

// GroupedTransactions interface
interface GroupedTransactions {
  [ticker: string]: {
    ticker: string;
    transactions: Transaction[];
    summary: {
      totalShares: number;
      averageCost: number;
      totalInvested: number;
      totalFees: number;
      currentHoldings: number;
      // Eski alanları uyumluluk için tanımlıyoruz
      totalCost?: number;
      remainingShares?: number;
      currentValue?: number;
      totalProfit?: number;
    };
  };
}

export default function NewTransactionsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const clerkAuth = useClerkAuthCache();
  const isPremium = getQuickPremiumStatus();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [transactionsData, setTransactionsData] = useState<GroupedTransactions>({});
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | 'sell'>('add');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [availableShares, setAvailableShares] = useState(0);
  const [averageCost, setAverageCost] = useState(0);
  
  // Account Summary metrics
  const [totalInvestment, setTotalInvestment] = useState(0);
  const [totalCurrentValue, setTotalCurrentValue] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalPositions, setTotalPositions] = useState(0);
  
  // Fetch Transactions from Firebase
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Quick auth check
      if (!isSignedIn && !clerkAuth.isSignedIn) {
        console.log('User not signed in, redirecting to login...');
        router.push('/login');
        return;
      }
      
      // Check premium status
      if (!isPremium) {
        console.log('Premium required, redirecting to pricing...');
        router.push('/pricing?premium=required');
        return;
      }
      
      // Get user ID
      const userId = user?.id || clerkAuth.userId;
      
      if (!userId) {
        console.error('User ID not found');
        setError('Authentication error: User ID not found. Please try logging out and logging back in.');
        setLoading(false);
        return;
      }
      
      console.log('Fetching transactions for user:', userId);
      
      try {
        // Get auth token
        const token = await getAuthTokenFromClient();
        
        if (!token) {
          console.error('Authentication token not available');
          setError('Authentication error: Token not available. Please try logging out and logging back in.');
          setLoading(false);
          return;
        }
        
        // Doğrudan API çağrısı yap
        const response = await fetch('/api/transactions', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch transactions');
        }
        
        const transactionsData = await response.json();
        console.log('Transactions fetched successfully:', Object.keys(transactionsData).length, 'tickers found');
        
        setTransactionsData(transactionsData as GroupedTransactions);
        
        // Calculate account summary
        let investment = 0;
        let currentValue = 0;
        let profit = 0;
        let positions = 0;
        
        Object.values(transactionsData).forEach((ticker: any) => {
          investment += ticker.summary.totalCost || ticker.summary.totalInvested || 0;
          currentValue += ticker.summary.currentValue || ticker.summary.totalInvested || 0;
          profit += ticker.summary.totalProfit || 0;
          
          if ((ticker.summary.remainingShares || ticker.summary.currentHoldings) > 0) {
            positions++;
          }
        });
        
        setTotalInvestment(investment);
        setTotalCurrentValue(currentValue);
        setTotalProfit(profit);
        setTotalPositions(positions);
      } catch (fetchError: any) {
        console.error('Error fetching transactions:', fetchError);
        
        // Fallback to Firebase direct fetch if API fails
        try {
          console.log('API call failed, trying direct Firebase fetch...');
          const groupedTransactions = await getTransactionsByTicker(userId);
          console.log('Firebase fetch successful');
          
          setTransactionsData(groupedTransactions as GroupedTransactions);
          
          // Calculate account summary
          let investment = 0;
          let currentValue = 0;
          let profit = 0;
          let positions = 0;
          
          Object.values(groupedTransactions).forEach(ticker => {
            investment += ticker.summary.totalCost || ticker.summary.totalInvested || 0;
            currentValue += ticker.summary.currentValue || ticker.summary.totalInvested || 0;
            profit += ticker.summary.totalProfit || 0;
            
            if ((ticker.summary.remainingShares || ticker.summary.currentHoldings) > 0) {
              positions++;
            }
          });
          
          setTotalInvestment(investment);
          setTotalCurrentValue(currentValue);
          setTotalProfit(profit);
          setTotalPositions(positions);
        } catch (firebaseError: any) {
          console.error('Firebase fetch also failed:', firebaseError);
          setError(firebaseError.message || 'Failed to load transactions from database');
        }
      }
    } catch (err: any) {
      console.error('General error:', err);
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [router, isSignedIn, clerkAuth, isPremium, user]);
  
  // Load transactions on page load
  useEffect(() => {
    if (isLoaded || clerkAuth.isLoaded) {
      fetchTransactions();
    }
  }, [fetchTransactions, isLoaded, clerkAuth.isLoaded]);
  
  // Add transaction handler
  const handleAddTransaction = (ticker?: string) => {
    setDialogMode('add');
    setSelectedTransaction(null);
    setSelectedTicker(ticker || '');
    setDialogOpen(true);
  };
  
  // Edit transaction handler
  const handleEditTransaction = (transaction: Transaction) => {
    setDialogMode('edit');
    setSelectedTransaction(transaction);
    setSelectedTicker(transaction.ticker);
    setDialogOpen(true);
  };
  
  // Sell stock handler
  const handleSellStock = (ticker: string, availableShares: number, avgCost: number) => {
    setDialogMode('sell');
    setSelectedTransaction(null);
    setSelectedTicker(ticker);
    setAvailableShares(availableShares);
    setAverageCost(avgCost);
    setDialogOpen(true);
  };
  
  // Delete transaction handler
  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return;
    }
    
    try {
      const token = await getAuthTokenFromClient();
      
      if (!token) {
        toast.error('Authentication token not available');
        return;
      }
      
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete transaction');
      }
      
      toast.success('Transaction deleted successfully');
      fetchTransactions();
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      toast.error(err.message || 'Failed to delete transaction');
    }
  };
  
  // Submit transaction handler
  const handleSubmitTransaction = async (data: Omit<Transaction, 'id'>) => {
    try {
      const token = await getAuthTokenFromClient();
      
      if (!token) {
        throw new Error('Authentication token not available');
      }
      
      if (dialogMode === 'edit' && selectedTransaction) {
        // Update existing transaction
        const response = await fetch(`/api/transactions/${selectedTransaction.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update transaction');
        }
      } else {
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
      }
      
      // Refresh transactions data
      fetchTransactions();
    } catch (error: any) {
      console.error('Transaction submission error:', error);
      throw error;
    }
  };
  
  const filteredStocks = Object.values(transactionsData)
    .filter(stock => stock.ticker.toLowerCase().includes(searchTerm.toLowerCase()));
  
  // Loading state
  if (loading) {
  return (
      <div className="bg-gray-50 min-h-screen">
      <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary-600" />
              <p className="mt-2 text-gray-600">Preparing to add transactions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="h-8 w-8 mx-auto text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
              <h2 className="mt-2 text-lg font-semibold text-gray-900">An error occurred</h2>
              <p className="mt-1 text-sm text-gray-600">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Refresh Page
              </button>
                    </div>
                  </div>
                </div>
              </div>
    );
  }
  
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
              <h1 className="text-3xl font-bold">Manage Transactions</h1>
            </div>
            <p className="text-gray-500">
              Track and manage your investment transactions by stock
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <Button 
              onClick={() => handleAddTransaction()}
              className="inline-flex items-center px-4 py-2 bg-primary-600 border border-transparent rounded-md font-semibold text-xs text-white tracking-widest hover:bg-primary-700 active:bg-primary-800 focus:outline-none focus:border-primary-800 focus:ring ring-primary-300 disabled:opacity-25 transition ease-in-out duration-150"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add New Transaction
            </Button>
          </div>
        </div>
        
        {/* Account Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-primary-100 rounded-md p-3">
                <svg className="h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
              <div className="ml-5">
                <h3 className="text-lg font-medium text-gray-900">Stocks</h3>
                <p className="text-gray-500 text-sm">Total: {totalPositions}</p>
                    </div>
                  </div>
                </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5">
                <h3 className="text-lg font-medium text-gray-900">Investment</h3>
                <p className="text-gray-500 text-sm">{formatCurrency(totalInvestment)}</p>
              </div>
                      </div>
                    </div>
                    
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5">
                <h3 className="text-lg font-medium text-gray-900">Current Value</h3>
                <p className="text-gray-500 text-sm">{formatCurrency(totalCurrentValue)}</p>
              </div>
                      </div>
                    </div>
                    
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center">
              <div className={`flex-shrink-0 ${totalProfit >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-md p-3`}>
                <svg className={`h-6 w-6 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                      </div>
              <div className="ml-5">
                <h3 className="text-lg font-medium text-gray-900">Profit/Loss</h3>
                <p className={`text-sm ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalProfit)}
                </p>
                      </div>
                    </div>
                      </div>
                    </div>
                    
        {/* Search and Filter */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
                      </div>
            <Input
                          type="text"
              placeholder="Search stocks by symbol..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    
        {/* Stock Cards */}
        <div className="space-y-6">
          {filteredStocks.length === 0 ? (
            <div className="bg-white rounded-lg p-6 text-center border border-gray-200">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
                <Search className="h-6 w-6 text-gray-600" />
                      </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No stocks found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {Object.keys(transactionsData).length === 0
                  ? "You haven't added any transactions yet."
                  : "No stocks match your search criteria."}
              </p>
              <div className="mt-6">
                <Button 
                  onClick={() => handleAddTransaction()}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 border border-transparent rounded-md font-semibold text-xs text-white tracking-widest hover:bg-primary-700 active:bg-primary-800 focus:outline-none focus:border-primary-800 focus:ring ring-primary-300 disabled:opacity-25 transition ease-in-out duration-150"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Your First Transaction
                </Button>
              </div>
            </div>
          ) : (
            filteredStocks.map((stock) => (
              <StockCard
                key={stock.ticker}
                ticker={stock.ticker}
                transactions={stock.transactions}
                summary={stock.summary}
                onAddTransaction={handleAddTransaction}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onSellStock={handleSellStock}
              />
            ))
          )}
          </div>
      </div>
      
      {/* Transaction Dialog */}
      <TransactionDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmitTransaction}
        defaultValues={selectedTransaction || undefined}
        mode={dialogMode}
        ticker={selectedTicker}
        availableShares={availableShares}
        averageCost={averageCost}
      />
    </div>
  );
} 