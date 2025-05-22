'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Loader2 } from 'lucide-react';
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

// GroupedTransactions interface
interface GroupedTransactions {
  [ticker: string]: {
    ticker: string;
    transactions: Transaction[];
    summary: {
      totalShares: number;
      totalCost: number;
      averageCost: number;
      remainingShares: number;
      currentValue: number;
      totalProfit: number;
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
        router.push('/login');
        return;
      }
      
      // Check premium status
      if (!isPremium) {
        router.push('/pricing?premium=required');
        return;
      }
      
      // Get user ID
      const userId = user?.id || clerkAuth.userId;
      
      if (!userId) {
        setError('User ID not found');
        setLoading(false);
        return;
      }
      
      // Get transactions by ticker
      const groupedTransactions = await getTransactionsByTicker(userId);
      setTransactionsData(groupedTransactions);
      
      // Calculate account summary
      let investment = 0;
      let currentValue = 0;
      let profit = 0;
      let positions = 0;
      
      Object.values(groupedTransactions).forEach(ticker => {
        investment += ticker.summary.totalCost;
        currentValue += ticker.summary.currentValue;
        profit += ticker.summary.totalProfit;
        
        if (ticker.summary.remainingShares > 0) {
          positions++;
        }
      });
      
      setTotalInvestment(investment);
      setTotalCurrentValue(currentValue);
      setTotalProfit(profit);
      setTotalPositions(positions);
      
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
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
  
  // Filter transactions by search term
  const filteredTransactions = searchTerm
    ? Object.entries(transactionsData)
        .filter(([ticker]) => ticker.toLowerCase().includes(searchTerm.toLowerCase()))
        .reduce((acc, [ticker, data]) => {
          acc[ticker] = data;
          return acc;
        }, {} as GroupedTransactions)
    : transactionsData;
  
  // Check if there are any transactions
  const hasTransactions = Object.keys(transactionsData).length > 0;
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Your Investments</h1>
          <p className="text-gray-500">
            Track your investment journal and monitor your portfolio performance
          </p>
        </div>
        <Button 
          onClick={() => handleAddTransaction()}
          className="mt-4 md:mt-0"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Transaction
        </Button>
      </div>
      
      {/* Account Summary */}
      {hasTransactions && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500">Total Investment</div>
            <div className="text-2xl font-bold">{formatCurrency(totalInvestment)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500">Current Value</div>
            <div className="text-2xl font-bold">{formatCurrency(totalCurrentValue)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500">Realized Profit/Loss</div>
            <div className={`text-2xl font-bold ${totalProfit > 0 ? 'text-green-600' : totalProfit < 0 ? 'text-red-600' : ''}`}>
              {formatCurrency(totalProfit)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="text-sm text-gray-500">Open Positions</div>
            <div className="text-2xl font-bold">{totalPositions}</div>
          </div>
        </div>
      )}
      
      {/* Search and Filter */}
      {hasTransactions && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            type="text"
            placeholder="Search stocks by symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
          <p className="text-gray-500">Loading your investment data...</p>
        </div>
      )}
      
      {/* Error State */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-600">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchTransactions}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      )}
      
      {/* Empty State */}
      {!loading && !error && !hasTransactions && (
        <div className="bg-blue-50 border border-blue-100 rounded-md p-8 text-center">
          <h3 className="text-xl font-medium mb-2">No investments yet</h3>
          <p className="text-gray-600 mb-4">
            Start tracking your investment journal by adding your first transaction.
          </p>
          <Button onClick={() => handleAddTransaction()}>
            <Plus className="mr-2 h-4 w-4" /> Add Your First Transaction
          </Button>
        </div>
      )}
      
      {/* Transaction List */}
      {!loading && !error && hasTransactions && (
        <div className="space-y-4">
          {Object.keys(filteredTransactions).length === 0 ? (
            <p className="text-gray-500 text-center py-8">No stocks match your search criteria</p>
          ) : (
            Object.entries(filteredTransactions)
              .sort(([, a], [, b]) => {
                // Sort by current value (descending)
                return b.summary.currentValue - a.summary.currentValue;
              })
              .map(([ticker, data]) => (
                <StockCard
                  key={ticker}
                  ticker={ticker}
                  transactions={data.transactions}
                  summary={data.summary}
                  onAddTransaction={handleAddTransaction}
                  onEditTransaction={handleEditTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onSellStock={handleSellStock}
                />
              ))
          )}
        </div>
      )}
      
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