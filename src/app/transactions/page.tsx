'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TransactionList from '@/components/transactions/TransactionList';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Upload, FileText, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getAuthTokenFromClient } from '@/lib/auth-client';
import { parse } from 'papaparse';
import * as XLSX from 'xlsx';

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

export default function TransactionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const [transactionCount, setTransactionCount] = useState(0);
  
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

  useEffect(() => {
    // If token exists, end loading state
    const token = getAuthTokenFromClient();
    if (token) {
      setPageLoading(false);
      return;
    }
    
    // If no token, run normal control mechanism
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        setPageLoading(false);
      }
    }
  }, [user, loading, router]);

  // Try to get transaction count
  useEffect(() => {
    const fetchTransactionCount = async () => {
      try {
        const token = getAuthTokenFromClient();
        if (!token) return;
        
        const response = await fetch('/api/transactions?count=true', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.count !== undefined) {
            setTransactionCount(data.count);
          }
        }
      } catch (error) {
        console.error('Failed to get transaction count:', error);
      }
    };
    
    fetchTransactionCount();
  }, []);

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
  };
  
  // Process CSV file
  const processCSV = (file: File) => {
    parse(file, {
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
    if (selectedRows.length === 0) {
      setError('Please select at least one transaction to import');
      return;
    }
    
    // Check if required fields are mapped
    const requiredFields: (keyof ColumnMapping)[] = ['ticker', 'date', 'transactionType', 'numberOfShares', 'sharePrice'];
    const missingFields = requiredFields.filter(field => !columnMapping[field]);
    
    if (missingFields.length > 0) {
      setError(`Please map the following required fields: ${missingFields.join(', ')}`);
      return;
    }
    
    setUploadLoading(true);
    setError(null);
    
    try {
      const token = getAuthTokenFromClient();
      if (!token) {
        setError('Authentication token is missing. Please log in again.');
        setUploadLoading(false);
        return;
      }
      
      // Prepare transactions for API
      const transactions = selectedRows.map(row => {
        const shares = parseFloat(row[columnMapping.numberOfShares] || '0');
        const price = parseFloat(row[columnMapping.sharePrice] || '0');
        
        const transaction = {
          ticker: row[columnMapping.ticker] || '',
          type: mapTransactionType(row[columnMapping.transactionType] || ''),
          shares: shares,
          price: price,
          amount: shares * price,
          date: formatDate(row[columnMapping.date] || ''),
          fee: columnMapping.fees ? parseFloat(row[columnMapping.fees] || '0') : undefined,
          notes: columnMapping.notes ? (row[columnMapping.notes] || '') : undefined
        };
        
        return transaction;
      });
      
      // Send to API
      const response = await fetch('/api/transactions/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transactions })
      });
      
      if (response.ok) {
        const result = await response.json();
        setSuccess(`Successfully imported ${result.count} transactions`);
        setShowUploadPanel(false);
        resetUploadPanel();
        
        // Refresh transaction count
        fetchTransactionCount();
        
        // Reload transactions list
        window.location.reload();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to import transactions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing transactions');
    } finally {
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

  const fetchTransactionCount = async () => {
    try {
      const token = getAuthTokenFromClient();
      if (!token) return;
      
      const response = await fetch('/api/transactions?count=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.count !== undefined) {
          setTransactionCount(data.count);
        }
      }
    } catch (error) {
      console.error('Failed to get transaction count:', error);
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
        <Footer />
      </>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Premium Content Notice */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-indigo-800">Premium Feature</h3>
              <div className="mt-1 text-sm text-indigo-600">
                <p>The Transactions page is available only to users with an active subscription. Free users can upgrade their account on the pricing page.</p>
              </div>
            </div>
          </div>
        </div>
        
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
              <div className="flex space-x-2">
                <Button
                  onClick={() => setShowUploadPanel(!showUploadPanel)}
                  variant="outline"
                  className="flex items-center"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  CSV/Excel Upload
                </Button>
                <Button asChild>
                  <Link href="/transactions/new" className="flex items-center">
                    <Plus className="mr-2 h-4 w-4" />
                    New Transaction
                  </Link>
                </Button>
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
              <TransactionList />
        </div>
      </div>
      <Footer />
    </div>
  );
} 