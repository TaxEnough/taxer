'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Upload, FileText, X, ChevronDown, ChevronRight, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getAuthTokenFromClient } from '@/lib/auth-client';
import { parse } from 'papaparse';
import * as XLSX from 'xlsx';
import { useUser } from '@clerk/nextjs';
import { toast } from 'react-hot-toast';
import { useClerkAuthCache, getQuickPremiumStatus } from '@/lib/clerk-utils';

// Define transaction data
interface ParsedTransaction {
  [key: string]: any;
}

// Column mapping
interface ColumnMapping {
  ticker: string;
  transactionType: string;
  numberOfShares: string;
  sharePrice: string;
  date: string;
  fees: string;
  notes: string;
}

// Transaction interface
interface Transaction {
  id: string;
  ticker: string;
  type: 'buy' | 'sell';
  shares: number;
  price: number;
  amount: number;
  date: string;
  fee?: number;
  notes?: string;
}

// Stock Group interface
interface StockGroup {
  ticker: string;
  transactions: Transaction[];
  totalShares: number;
  totalBuyShares: number; 
  totalSellShares: number;
  averageCost: number;
  totalCost: number;
  totalFees: number;
  remainingShares: number;
  remainingValue: number;
  realizedProfitLoss: number;
  isOpen: boolean;
}

export default function TransactionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stockGroups, setStockGroups] = useState<StockGroup[]>([]);
  
  // Clerk Auth kullan - useClerkAuthCache hook'unu ekle
  const { isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn, user: clerkUser } = useUser();
  const clerkAuth = useClerkAuthCache(); // Hızlı auth kontrolü için
  
  // Hızlı premium kontrolü yap
  const isPremium = getQuickPremiumStatus();
  
  // State for CSV/Excel upload operations
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileData, setFileData] = useState<ParsedTransaction[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isFileLoaded, setIsFileLoaded] = useState<boolean>(false);
  const [selectedRows, setSelectedRows] = useState<ParsedTransaction[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Column mapping
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    ticker: '',
    transactionType: '',
    numberOfShares: '',
    sharePrice: '',
    date: '',
    fees: '',
    notes: ''
  });

  // Group transactions by ticker
  const groupTransactionsByStock = useCallback((transactions: Transaction[]) => {
    // Group transactions by ticker
    const groupedByTicker: { [key: string]: Transaction[] } = {};
    
    transactions.forEach(transaction => {
      if (!groupedByTicker[transaction.ticker]) {
        groupedByTicker[transaction.ticker] = [];
      }
      
      groupedByTicker[transaction.ticker].push(transaction);
    });
    
    // Calculate statistics for each stock group
    const groups: StockGroup[] = Object.keys(groupedByTicker).map(ticker => {
      const tickerTransactions = groupedByTicker[ticker];
      
      // Sort transactions by date (oldest first)
      tickerTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Calculate buy and sell totals
      const buyTransactions = tickerTransactions.filter(t => t.type === 'buy');
      const sellTransactions = tickerTransactions.filter(t => t.type === 'sell');
      
      const totalBuyShares = buyTransactions.reduce((sum, t) => sum + t.shares, 0);
      const totalSellShares = sellTransactions.reduce((sum, t) => sum + t.shares, 0);
      const remainingShares = totalBuyShares - totalSellShares;
      
      // Calculate total cost and fees
      const totalCost = buyTransactions.reduce((sum, t) => sum + (t.amount || t.price * t.shares), 0);
      const totalFees = tickerTransactions.reduce((sum, t) => sum + (t.fee || 0), 0);
      
      // Calculate average cost - using Math.round for precise calculation
      const averageCost = totalBuyShares > 0 ? Math.round(((totalCost + totalFees) / totalBuyShares) * 100) / 100 : 0;
      
      // Calculate realized profit/loss from sold shares
      let realizedProfitLoss = 0;
      
      sellTransactions.forEach(sell => {
        const sellAmount = sell.amount || (sell.price * sell.shares);
        const costBasis = averageCost * sell.shares;
        const sellFee = sell.fee || 0;
        
        realizedProfitLoss += (sellAmount - sellFee) - costBasis;
      });
      
      // Calculate remaining value
      const remainingValue = remainingShares * averageCost;
      
      return {
        ticker,
        transactions: tickerTransactions,
        totalShares: totalBuyShares,
        totalBuyShares,
        totalSellShares,
        averageCost,
        totalCost,
        totalFees,
        remainingShares,
        remainingValue,
        realizedProfitLoss,
        isOpen: true // Default expanded
      };
    });
    
    // Sort groups by ticker
    groups.sort((a, b) => a.ticker.localeCompare(b.ticker));
    
    return groups;
  }, []);

  // Fetch transactions with auth check
  const fetchTransactions = useCallback(async () => {
    setPageLoading(true);
    setError(null);
    
    try {
      // Hızlı auth kontrolü yap
      const isAuthenticated = clerkAuth.isSignedIn || !!user;
      
      // Check authentication based on Clerk first, then fallback to Firebase
      if (!isAuthenticated) {
        console.log('User not authenticated, redirecting to login page');
        router.push('/login');
        return;
      }
      
      // Hızlı premium kontrolü yap
      if (!isPremium) {
        console.log('User does not have premium access, redirecting to pricing page');
        router.push('/pricing?premium=required');
        return;
      }
      
      // Get token (prefer Clerk, fallback to custom auth)
      const token = await getAuthTokenFromClient();
      
      if (!token) {
        setError('Authentication token not available');
        setPageLoading(false);
        return;
      }
      
      console.log('Fetching transactions for user');
      
      // API'den işlemleri çek
      const response = await fetch('/api/transactions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch transactions');
      }
      
      const transactionsData = await response.json();
      
      if (!transactionsData || !Array.isArray(transactionsData)) {
        console.log('No transactions found for user');
        setTransactions([]);
        setStockGroups([]);
        setPageLoading(false);
        return;
      }
      
      // Format transaction data
      const fetchedTransactions: Transaction[] = transactionsData.map((item: any) => ({
        id: item.id,
        ticker: item.ticker || '',
        type: item.type || 'buy',
        shares: parseFloat(item.shares) || 0,
        price: parseFloat(item.price) || 0,
        amount: parseFloat(item.amount) || 0,
        date: item.date || '',
        fee: parseFloat(item.fee) || 0,
        notes: item.notes || '',
      }));
      
      setTransactions(fetchedTransactions);
      
      // Group transactions by stock
      const groups = groupTransactionsByStock(fetchedTransactions);
      setStockGroups(groups);
      
      setPageLoading(false);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.message || 'Failed to load transactions');
      setPageLoading(false);
    }
  }, [router, user, clerkAuth.isSignedIn, isPremium, groupTransactionsByStock]);

  // Initialize and load transactions
  useEffect(() => {
    // Wait for auth to be loaded before fetching
    if (isClerkLoaded || !loading) {
      fetchTransactions();
    }
  }, [fetchTransactions, isClerkLoaded, loading]);

  // Delete transaction handler
  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return;
    }
    
    try {
      // Get auth token
      const token = await getAuthTokenFromClient();
      
      if (!token) {
        toast.error('Authentication token not available');
        return;
      }
      
      // Call API to delete transaction
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete transaction');
      }
      
      // Update UI
      fetchTransactions();
      
      toast.success('Transaction deleted successfully');
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      toast.error(err.message || 'Failed to delete transaction');
    }
  };

  // Toggle stock group expand/collapse
  const toggleStockGroup = (ticker: string) => {
    setStockGroups(prevGroups => 
      prevGroups.map(group => 
        group.ticker === ticker ? { ...group, isOpen: !group.isOpen } : group
      )
    );
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format number
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Format percentage
  const formatPercentage = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num / 100);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? dateString : date.toLocaleDateString();
  };

  // Loading state
  if (loading && pageLoading && !getAuthTokenFromClient()) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Transactions</h1>
            <p className="text-gray-500">
              View and manage your transaction history
            </p>
          </div>
          <div className="flex space-x-2 mt-4 md:mt-0">
            <Link 
              href="/transactions/new"
              className="inline-flex items-center px-4 py-2 bg-primary-600 border border-transparent rounded-md font-semibold text-xs text-white tracking-widest hover:bg-primary-700 active:bg-primary-800 focus:outline-none focus:border-primary-800 focus:ring ring-primary-300 disabled:opacity-25 transition ease-in-out duration-150"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add New
            </Link>
            <Button
              onClick={() => setShowUploadPanel(!showUploadPanel)}
              variant="outline"
              size="sm"
              className="inline-flex items-center"
            >
              {showUploadPanel ? (
                <>
                  <X className="h-4 w-4 mr-1" /> Close Upload
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" /> Import
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards showing portfolio summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-primary-100 rounded-md p-3">
                <svg className="h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-5">
                <h3 className="text-sm font-medium text-gray-500">Total Investments</h3>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(stockGroups.reduce((sum, group) => sum + group.remainingValue, 0))}
                </p>
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
                <h3 className="text-sm font-medium text-gray-500">Realized Profit/Loss</h3>
                <p className={`text-lg font-semibold ${
                  stockGroups.reduce((sum, group) => sum + group.realizedProfitLoss, 0) >= 0 
                  ? 'text-green-600' 
                  : 'text-red-600'}`}>
                  {formatCurrency(stockGroups.reduce((sum, group) => sum + group.realizedProfitLoss, 0))}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-5">
                <h3 className="text-sm font-medium text-gray-500">Total Stocks</h3>
                <p className="text-lg font-semibold text-gray-900">
                  {stockGroups.length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
                <svg className="h-6 w-6 text-orange-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div className="ml-5">
                <h3 className="text-sm font-medium text-gray-500">Total Transactions</h3>
                <p className="text-lg font-semibold text-gray-900">
                  {transactions.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="bg-white rounded-lg shadow-sm">
          <h2 className="text-xl font-medium text-gray-900 p-6 border-b">Transaction History</h2>
          
          {stockGroups.length === 0 ? (
            <div className="p-6 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions</h3>
              <p className="mt-1 text-sm text-gray-500">Start tracking your investment journal by adding a new transaction.</p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => router.push('/transactions/new')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  <svg
                    className="-ml-1 mr-2 h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  New Transaction
                </button>
              </div>
            </div>
          ) : (
            <div>
              {stockGroups.map(group => (
                <div key={group.ticker} className="border-b last:border-b-0">
                  {/* Stock Group Header */}
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleStockGroup(group.ticker)}
                  >
                    <div className="flex items-center">
                      {group.isOpen ? (
                        <ChevronDown className="h-5 w-5 text-gray-500 mr-2" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500 mr-2" />
                      )}
                      <h3 className="text-lg font-medium text-gray-900">{group.ticker}</h3>
                      <span className="ml-2 text-sm text-gray-500">{group.remainingShares > 0 ? formatNumber(group.remainingShares) + ' shares' : '(Closed Position)'}</span>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Avg. Cost</div>
                        <div className="font-medium">{formatCurrency(group.averageCost)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Current Value</div>
                        <div className="font-medium">{formatCurrency(group.remainingValue)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Realized P/L</div>
                        <div className={`font-medium ${group.realizedProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(group.realizedProfitLoss)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Transactions Table */}
                  {group.isOpen && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Shares
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Price
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Fees
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Avg. Cost
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              P/L
                            </th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {group.transactions.map((transaction) => {
                            // Calculate profit/loss for sell transactions
                            const isProfitLossRelevant = transaction.type === 'sell';
                            const costBasis = group.averageCost * transaction.shares;
                            const transactionTotal = transaction.amount || (transaction.price * transaction.shares);
                            const profitLoss = isProfitLossRelevant ? transactionTotal - costBasis - (transaction.fee || 0) : 0;
                            
                            return (
                              <tr key={transaction.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      transaction.type === 'buy'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {transaction.type === 'buy' ? 'Buy' : 'Sell'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatDate(transaction.date)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                  {formatNumber(transaction.shares)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                  {formatCurrency(transaction.price)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                  {formatCurrency(transaction.fee || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                  {formatCurrency(transactionTotal)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                  {transaction.type === 'buy' ? formatCurrency(group.averageCost) : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                  {isProfitLossRelevant ? (
                                    <span className={profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      {formatCurrency(profitLoss)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                  <div className="flex justify-center space-x-2">
                                    <button
                                      onClick={() => router.push(`/transactions/${transaction.id}`)}
                                      className="p-1 rounded-full hover:bg-gray-100"
                                      title="View Details"
                                    >
                                      <ExternalLink className="h-4 w-4 text-gray-500" />
                                    </button>
                                    <button
                                      onClick={() => router.push(`/transactions/edit/${transaction.id}`)}
                                      className="p-1 rounded-full hover:bg-gray-100"
                                      title="Edit"
                                    >
                                      <Pencil className="h-4 w-4 text-gray-500" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTransaction(transaction.id)}
                                      className="p-1 rounded-full hover:bg-gray-100"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          
                          {/* Summary row */}
                          <tr className="bg-gray-50">
                            <td colSpan={2} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              Summary
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              {formatNumber(group.remainingShares)} (remaining)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              {formatCurrency(group.averageCost)} (avg)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              {formatCurrency(group.totalFees)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              {formatCurrency(group.remainingValue)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              -
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                              <span className={group.realizedProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(group.realizedProfitLoss)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                              -
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 