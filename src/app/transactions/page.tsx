'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import TransactionList from '@/components/transactions/TransactionList';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Upload, FileText, X } from 'lucide-react';
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
  transactionType: 'Buy' | 'Sell';
  numberOfShares: number;
  pricePerShare: number;
  totalAmount: number;
  transactionDate: string | any;
  commissionFees?: number;
  notes?: string;
}

export default function TransactionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const [transactionCount, setTransactionCount] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
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
        setTransactionCount(0);
        setTransactions([]);
        setPageLoading(false);
        return;
      }
      
      // Format transaction data
      const fetchedTransactions: Transaction[] = transactionsData.map((item: any) => ({
        id: item.id,
        ticker: item.ticker || '',
        transactionType: item.type === 'buy' ? 'Buy' : 'Sell',
        numberOfShares: item.shares || 0,
        pricePerShare: item.price || 0,
        totalAmount: item.amount || 0,
        transactionDate: item.date || '',
        commissionFees: item.fee || 0,
        notes: item.notes || '',
      }));
      
      setTransactions(fetchedTransactions);
      setTransactionCount(fetchedTransactions.length);
      setPageLoading(false);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.message || 'Failed to load transactions');
      setPageLoading(false);
    }
  }, [router, user, clerkAuth.isSignedIn, isPremium]);

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

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Standard column names (includes variations)
  const standardColumns = {
    ticker: ['ticker', 'symbol', 'stock', 'code'],
    transactionType: ['transaction type', 'type', 'transaction', 'trade type', 'buy/sell'],
    numberOfShares: ['number of shares', 'shares', 'quantity', 'amount'],
    sharePrice: ['price per share', 'price', 'share price', 'unit price'],
    date: ['transaction date', 'date', 'trade date'],
    fees: ['commission', 'fees', 'fee'],
    notes: ['notes', 'note', 'comment']
  };

  // Pre-process file
  const processInitialFile = (data: ParsedTransaction[], headers: string[]) => {
    setFileData(data);
    setHeaders(headers);
    
    // Automatic column mapping
    const newMapping: ColumnMapping = {
      ticker: '',
      transactionType: '',
      numberOfShares: '',
      sharePrice: '',
      date: '',
      fees: '',
      notes: ''
    };
    
    // Find potential match for each header
    headers.forEach(header => {
      const headerLower = header.toLowerCase().trim();
      
      // Check for each standard column
      Object.entries(standardColumns).forEach(([key, possibleNames]) => {
        if (possibleNames.some(name => headerLower.includes(name)) && !newMapping[key as keyof ColumnMapping]) {
          newMapping[key as keyof ColumnMapping] = header;
        }
      });
    });
    
    setColumnMapping(newMapping);
    setIsFileLoaded(true);
    setIsAnalyzing(false);
    setSuccess('File processed successfully. Please map the columns below.');
  };
  
  // Process CSV file
  const processCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      parse(csvText, {
        header: true,
        complete: (results) => {
          try {
            if (!results.data || !Array.isArray(results.data) || results.data.length === 0) {
              throw new Error('Invalid CSV file format');
            }
            
            const headers = results.meta.fields || [];
            if (headers.length === 0) {
              throw new Error('No column headers found in CSV file');
            }

            processInitialFile(results.data as ParsedTransaction[], headers);
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Error processing file');
            setIsAnalyzing(false);
          }
        },
        error: (error) => {
          setError(`File reading error: ${error.message}`);
          setIsAnalyzing(false);
        }
      });
    };
    reader.onerror = () => {
      setError('Error reading the file');
      setIsAnalyzing(false);
    };
    reader.readAsText(file);
  };

  // Process Excel file
  const processExcel = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          if (jsonData.length === 0) {
            throw new Error('Not enough data found in Excel file');
          }

          // Get headers
          const sampleData = jsonData[0] as Record<string, unknown>;
          const headers = Object.keys(sampleData);
          
          processInitialFile(jsonData as ParsedTransaction[], headers);
          setError(null);
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Error processing Excel file');
          setIsAnalyzing(false);
        }
      };
      reader.onerror = (error) => {
        setError('File reading error');
        setIsAnalyzing(false);
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing Excel file');
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccess(null);
      setIsFileLoaded(false);
      setIsAnalyzing(true);
      
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop()?.toLowerCase();

      if (fileExt === 'csv') {
        processCSV(file);
      } else if (fileExt === 'xlsx' || fileExt === 'xls') {
        processExcel(file);
      } else {
        setError('Unsupported file format. Please upload a CSV or Excel file.');
        setIsAnalyzing(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
      setSuccess(null);
      setIsFileLoaded(false);
      setIsAnalyzing(true);
      
      const file = e.dataTransfer.files[0];
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExt === 'csv') {
        processCSV(file);
      } else if (fileExt === 'xlsx' || fileExt === 'xls') {
        processExcel(file);
      } else {
        setError('Unsupported file format. Please upload a CSV or Excel file.');
        setIsAnalyzing(false);
      }
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  
  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping({
      ...columnMapping,
      [field]: value
    });
  };

  const toggleRowSelection = (index: number) => {
    if (selectedRows.includes(fileData[index])) {
      setSelectedRows(selectedRows.filter(row => row !== fileData[index]));
    } else {
      setSelectedRows([...selectedRows, fileData[index]]);
    }
  };

  const toggleAllRows = () => {
    if (selectedRows.length === fileData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows([...fileData]);
    }
  };

  const processSelectedRows = async () => {
    setUploadLoading(true);
    setError(null);
    
    try {
      // Check if required fields are mapped
      const requiredFields: (keyof ColumnMapping)[] = ['ticker', 'transactionType', 'numberOfShares', 'sharePrice', 'date'];
      const missingFields = requiredFields.filter(field => !columnMapping[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Required columns not mapped: ${missingFields.join(', ')}`);
      }
      
      // Get token
      const token = await getAuthTokenFromClient();
      
      if (!token) {
        throw new Error('Authentication token not available');
      }
      
      // Prepare transactions for API
      const transactions = selectedRows.map(row => {
        const ticker = row[columnMapping.ticker]?.toString().trim();
        const typeRaw = row[columnMapping.transactionType]?.toString().toLowerCase().trim();
        const sharesRaw = row[columnMapping.numberOfShares]?.toString().replace(/,/g, '');
        const priceRaw = row[columnMapping.sharePrice]?.toString().replace(/[^0-9.-]+/g, '');
        const dateRaw = row[columnMapping.date];
        const feesRaw = columnMapping.fees ? row[columnMapping.fees]?.toString().replace(/[^0-9.-]+/g, '') : '0';
        const notes = columnMapping.notes ? row[columnMapping.notes]?.toString() : '';
        
        if (!ticker || !typeRaw || !sharesRaw || !priceRaw || !dateRaw) {
          throw new Error('Missing required transaction data in selected rows');
        }
        
        const shares = parseFloat(sharesRaw);
        const price = parseFloat(priceRaw);
        const amount = shares * price;
        const fee = feesRaw ? parseFloat(feesRaw) : 0;
        
        return {
          ticker: ticker.toUpperCase(),
          type: mapTransactionType(typeRaw),
          shares,
          price,
          amount,
          date: formatDate(dateRaw),
          fee,
          notes
        };
      });
      
      if (transactions.length === 0) {
        throw new Error('No valid transactions to upload');
      }
      
      // Upload to API
      const response = await fetch('/api/transactions/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transactions })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload transactions');
      }
      
      const resultData = await response.json();
      
      // Successfully uploaded
      setSuccess(`${resultData.count || transactions.length} transactions uploaded successfully!`);
      setUploadLoading(false);
      
      // Refresh transaction list
      fetchTransactions();
      
      // Reset upload panel after a short delay
      setTimeout(() => {
        resetUploadPanel();
      }, 2000);
      
    } catch (err: any) {
      console.error('Error processing transactions:', err);
      setError(err.message || 'Failed to process transactions');
      setUploadLoading(false);
    }
  };

  // Helper to map transaction type variations to standard types
  const mapTransactionType = (type: string): 'buy' | 'sell' | 'dividend' => {
    const lowerType = type.toLowerCase().trim();
    
    if (lowerType.includes('buy') || lowerType.includes('alım') || lowerType.includes('alim') || lowerType === 'b') {
      return 'buy';
    } else if (lowerType.includes('sell') || lowerType.includes('satım') || lowerType.includes('satim') || lowerType === 's') {
      return 'sell';
    } else if (lowerType.includes('div') || lowerType.includes('temettü') || lowerType.includes('dividend')) {
      return 'dividend';
    }
    
    // Default to buy if unknown
    return 'buy';
  };

  // Helper to format dates consistently
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // Try alternate formats if standard parsing fails
        const parts = dateString.split(/[/.-]/);
        if (parts.length === 3) {
          // Try different date formats (MM/DD/YYYY, DD/MM/YYYY, etc.)
          const possibleFormats = [
            new Date(`${parts[2]}-${parts[0]}-${parts[1]}`), // MM/DD/YYYY
            new Date(`${parts[2]}-${parts[1]}-${parts[0]}`), // DD/MM/YYYY
            new Date(`${parts[0]}-${parts[1]}-${parts[2]}`), // YYYY/MM/DD
          ];
          
          for (const format of possibleFormats) {
            if (!isNaN(format.getTime())) {
              date.setTime(format.getTime());
              break;
            }
          }
        }
      }
      
      if (isNaN(date.getTime())) {
        // If all parsing attempts fail, return original string
        return dateString;
      }
      
      // Format as YYYY-MM-DD for API
      return date.toISOString().split('T')[0];
    } catch (error) {
      return dateString;
    }
  };

  const resetUploadPanel = () => {
    setFile(null);
    setFileData([]);
    setHeaders([]);
    setIsFileLoaded(false);
    setSelectedRows([]);
    setColumnMapping({
      ticker: '',
      transactionType: '',
      numberOfShares: '',
      sharePrice: '',
      date: '',
      fees: '',
      notes: ''
    });
    setError(null);
    setSuccess(null);
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
            <Link 
              href="/transactions/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 border border-transparent rounded-md font-semibold text-xs text-white tracking-widest hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:border-blue-800 focus:ring ring-blue-300 disabled:opacity-25 transition ease-in-out duration-150"
            >
              <FileText className="h-4 w-4 mr-1" />
              New Interface
            </Link>
          </div>
        </div>

        {/* Upload panel - shown conditionally */}
        {showUploadPanel && (
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-5">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-medium text-gray-900">Import Transactions</h2>
              <button 
                onClick={() => setShowUploadPanel(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {!isFileLoaded ? (
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) {
                    setFile(e.dataTransfer.files[0]);
                    // Process file logic would go here
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <div className="mx-auto flex justify-center">
                  <FileText className="h-10 w-10 text-gray-400" />
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900">
                  Drag and drop your CSV or Excel file here
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Supported formats: CSV, XLSX, XLS
                </p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <div className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 cursor-pointer">
                    Select File
                  </div>
                </label>
              </div>
            ) : (
              <div>
                {/* File loaded view would go here */}
                <p>File processing interface would appear here</p>
              </div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-primary-100 rounded-md p-3">
                <svg className="h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-5">
                <h3 className="text-lg font-medium text-gray-900">Transactions</h3>
                <p className="text-gray-500 text-sm">Total: {transactionCount}</p>
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
                <h3 className="text-lg font-medium text-gray-900">Profit</h3>
                <p className="text-gray-500 text-sm">Calculate in Reports</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
                <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-5">
                <h3 className="text-lg font-medium text-gray-900">Tax Estimate</h3>
                <p className="text-gray-500 text-sm">View in Reports</p>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="bg-white rounded-lg">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Transaction History</h2>
          {transactions.length === 0 ? (
            <div className="bg-white shadow-sm rounded-lg p-6 text-center">
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
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new transaction.</p>
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticker
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shares
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {transaction.ticker}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            transaction.transactionType === 'Buy'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {transaction.transactionType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.numberOfShares}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(transaction.pricePerShare)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(transaction.totalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {typeof transaction.transactionDate === 'string' 
                          ? transaction.transactionDate 
                          : formatDate(String(transaction.transactionDate))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          className="text-red-600 hover:text-red-900 mr-2"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => router.push(`/transactions/${transaction.id}`)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 