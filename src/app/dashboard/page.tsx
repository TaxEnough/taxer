'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getAuthTokenFromClient } from '@/lib/auth-client';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useClerkAuthCache } from '@/lib/clerk-utils';
import { getClientPremiumStatus } from '@/lib/auth-client';

// Lazy load edilmiş bileşenler için
import dynamic from 'next/dynamic';

// StockTaxCalculator bileşenini doğrudan import et
import StockTaxCalculatorComponent from '@/components/dashboard/StockTaxCalculator';

// StockTaxCalculator bileşeni için wrapper
const StockTaxCalculator = (props: any) => {
  return <StockTaxCalculatorComponent {...props} />;
};

// Trade veri tipi tanımı
interface TradeData {
  ticker: string;
  transactionType: 'Buy' | 'Sell';
  numberOfShares: number;
  pricePerShare: number;
  transactionDate: string;
  totalAmount: number;
  commissionFees: number;
  buyPrice?: number;  // Purchase price added
  buyDate?: string;   // Purchase date added
  sellPrice?: number; // Selling price added
  sellDate?: string;  // Selling date added
}

// Stock tipini buraya da ekle
interface Stock {
  id: string;
  symbol: string;
  purchasePrice: number;
  sellingPrice: number;
  sharesSold: number;
  tradingFees: number;
  holdingPeriod: number;
  gainLoss?: number;
  isShortTerm?: boolean;
}

// Yükleniyor bileşeni
function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center h-40">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
    </div>
  );
}

export default function DashboardPage() {
  const { user: firebaseUser, loading: firebaseLoading } = useAuth();
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn, user: clerkUser } = useUser();
  const clerkAuth = useClerkAuthCache();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  
  // Dosya yükleme state'leri
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<any[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<TradeData[]>([]);
  
  // Add this new state for the collapsible panel
  const [isTradeHistoryOpen, setIsTradeHistoryOpen] = useState(false);
  
  // Stock tipini buraya da ekle
  const [calculatorStocks, setCalculatorStocks] = useState<Stock[]>([]);
  
  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadedFile(file);
      setUploadError(null);
      
      // Basic file type check
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
        setUploadError('Unsupported file format. Please upload a CSV or Excel file.');
        return;
      }
      
      // Read the file
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          // For demonstration purposes, we'll parse a simple CSV format
          // In a real app, you'd want to use a proper CSV/Excel parsing library
          const text = event.target?.result as string;
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          
          // Skip header row and parse data rows
          const data = lines.slice(1).filter(line => line.trim().length > 0).map(line => {
            const values = line.split(',').map(v => v.trim());
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            return row;
          });
          
          setFileData(data);
          
          // Process data into a format compatible with the calculator
          const processed: TradeData[] = data.map((row, index) => {
            // Here you would adapt the CSV data format to your application's needs
            return {
              ticker: row.Symbol || row.Ticker || '',
              transactionType: (row['Transaction Type'] || '').toLowerCase().includes('sell') ? 'Sell' : 'Buy',
              numberOfShares: parseFloat(row['Number of Shares'] || row.Shares || '0'),
              pricePerShare: parseFloat(row['Buy Price'] || row['Sell Price'] || row.Price || '0'),
              transactionDate: row['Buy Date'] || row['Sell Date'] || row.Date || '',
              totalAmount: parseFloat(row['Total Amount'] || '0'),
              commissionFees: parseFloat(row['Commission/Fees'] || row.Fees || '0'),
              buyPrice: parseFloat(row['Buy Price'] || '0'),
              buyDate: row['Buy Date'] || '',
              sellPrice: parseFloat(row['Sell Price'] || '0'),
              sellDate: row['Sell Date'] || ''
            };
          });
          
          setProcessedData(processed);
          console.log('Processed data:', processed);
        } catch (error) {
          console.error('Error parsing file:', error);
          setUploadError('Error parsing file. Please check the file format.');
        }
      };
      
      reader.onerror = () => {
        setUploadError('Error reading file. Please try again.');
      };
      
      reader.readAsText(file);
    }
  };
  
  // İşlenen verileri hesap makinesine aktar
  const transferToCalculator = () => {
    if (!processedData.length) {
      alert('No data to transfer');
      return;
    }
    const sellTransactions = processedData.filter(data => data.transactionType === 'Sell');
    if (sellTransactions.length === 0) {
      alert('No sell transactions found to transfer');
      return;
    }
    // SELL işlemlerini Stock formatına çevir
    const stocks: Stock[] = sellTransactions.map((item, idx) => ({
      id: `${item.ticker}-${idx}-${Date.now()}`,
      symbol: item.ticker,
      purchasePrice: item.buyPrice || item.pricePerShare || 0,
      sellingPrice: item.sellPrice || item.pricePerShare || 0,
      sharesSold: item.numberOfShares || 0,
      tradingFees: item.commissionFees || 0,
      holdingPeriod: calculateHoldingPeriod(item.buyDate || item.transactionDate, item.sellDate || item.transactionDate),
    }));
    setCalculatorStocks(stocks);
    alert('Data successfully transferred to the tax calculator');
  };

  // Alış ve satış tarihinden ay farkını hesapla
  function calculateHoldingPeriod(buyDateStr?: string, sellDateStr?: string) {
    if (!buyDateStr || !sellDateStr) return 0;
    
    try {
      // Tarih formatını kontrol et ve uygun şekilde dönüştür
      let buyDate: Date;
      let sellDate: Date;
      
      // Tarih formatını algılamaya çalış
      if (buyDateStr.includes('-')) {
        // ISO format (YYYY-MM-DD)
        buyDate = new Date(buyDateStr);
      } else if (buyDateStr.includes('/')) {
        // US format (MM/DD/YYYY)
        const [month, day, year] = buyDateStr.split('/').map(Number);
        buyDate = new Date(year, month - 1, day);
      } else {
        // Diğer formatlar için doğrudan dene
        buyDate = new Date(buyDateStr);
      }
      
      if (sellDateStr.includes('-')) {
        sellDate = new Date(sellDateStr);
      } else if (sellDateStr.includes('/')) {
        const [month, day, year] = sellDateStr.split('/').map(Number);
        sellDate = new Date(year, month - 1, day);
      } else {
        sellDate = new Date(sellDateStr);
      }
      
      // Check if dates are valid
      if (isNaN(buyDate.getTime()) || isNaN(sellDate.getTime())) {
        console.error("Invalid date format:", buyDateStr, sellDateStr);
        return 0;
      }
      
      return (sellDate.getFullYear() - buyDate.getFullYear()) * 12 + (sellDate.getMonth() - buyDate.getMonth());
    } catch (error) {
      console.error("Date conversion error:", error);
      return 0;
    }
  }

  // Handle CSV sample download
  const handleDownloadSample = () => {
    const sampleCSVContent = `Symbol,Transaction Type,Number of Shares,Buy Price,Buy Date,Sell Price,Sell Date,Total Amount,Commission/Fees
AAPL,Buy,10,150.25,2023-01-15,,,1502.50,7.99
AAPL,Sell,5,150.25,2023-01-15,180.75,2023-06-20,903.75,7.99
MSFT,Buy,8,270.50,2023-02-10,,,2164.00,7.99
MSFT,Sell,4,270.50,2023-02-10,320.45,2023-08-15,1281.80,7.99
GOOGL,Buy,2,2450.75,2023-03-10,,,4901.50,7.99
GOOG,Sell,1,2500.00,2023-02-01,2750.50,2023-05-10,2750.50,9.99
TSLA,Buy,15,200.50,2023-03-01,,,3007.50,7.99
TSLA,Sell,7,200.50,2023-03-01,235.75,2023-07-15,1650.25,7.99`;

    const blob = new Blob([sampleCSVContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-trading-history.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // İlk render'da bir kez çalışması için ref kullan
  const initRef = useRef(false);

  useEffect(() => {
    const checkAuthAndRoute = async () => {
      setPageLoading(true);
      
      try {
        // Önce Clerk ile kontrol et
        if (clerkLoaded) {
          if (clerkSignedIn && clerkUser) {
            console.log('Clerk kullanıcısı bulundu');
            setPageLoading(false);
          } else {
            console.log('Clerk kullanıcısı bulunamadı, yönlendiriliyor...');
            router.push('/login');
          }
          return;
        }
        
        // Alternatif olarak Auth Context kontrol et
        if (firebaseUser && !firebaseLoading) {
          console.log('Auth Context kullanıcısı bulundu');
          setPageLoading(false);
          return;
        }
        
        // Token kontrolü yap
        const token = await getAuthTokenFromClient();
        if (token) {
          console.log('Token bulundu');
          setPageLoading(false);
        } else {
          console.log('Oturum açılmamış, yönlendiriliyor...');
          router.push('/login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/login');
      }
    };
    
    checkAuthAndRoute();
  }, [router, firebaseUser, firebaseLoading, clerkLoaded, clerkSignedIn, clerkUser]);

  // Premium kontrolü için fonksiyon eklendi
  useEffect(() => {
    const checkPremiumStatus = async () => {
      // Kullanıcının premium durumunu kontrol et
      const premiumStatus = getClientPremiumStatus();
      
      if (!premiumStatus.isPremium) {
        console.log('Premium hesap bulunamadı, yönlendiriliyor...');
        router.push('/pricing?premium=required');
      }
    };
    
    // Kullanıcı oturum açtıysa premium durumunu kontrol et
    if (firebaseUser && !firebaseLoading || (clerkLoaded && clerkSignedIn)) {
      checkPremiumStatus();
    }
  }, [router, firebaseUser, firebaseLoading, clerkLoaded, clerkSignedIn]);

  // Yükleniyor durumu göster
  if ((!clerkLoaded && firebaseLoading) || (pageLoading && !getAuthTokenFromClient() && !clerkSignedIn)) {
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

  // Kullanıcı ismini belirle (önce Clerk, yoksa Firebase)
  const userName = clerkUser?.firstName || clerkUser?.username || firebaseUser?.name || 'User';

  return (
    <>
      <Navbar />
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sol Panel - Daha hafif yükleme */}
            <div className="w-full lg:w-1/3 bg-white shadow-sm rounded-lg p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Dashboard</h1>
              
              <div className="bg-primary-50 border border-primary-200 rounded-md p-3 mb-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                    </svg>
                  </div>
                  <div className="ml-2">
                    <h2 className="text-md font-medium text-primary-800">Welcome, {userName}!</h2>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Transactions</h3>
                  <p className="text-lg font-semibold text-gray-900">0</p>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Gains</h3>
                  <p className="text-lg font-semibold text-green-600">$0.00</p>
                </div>
                
                <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Tax</h3>
                  <p className="text-lg font-semibold text-red-600">$0.00</p>
                </div>
              </div>
              
              <div className="mt-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
                
                <div className="grid grid-cols-1 gap-3">
                  <a
                    href="/transactions/new" 
                    className="flex items-center justify-between p-3 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-primary-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span className="text-sm">Add New Transaction</span>
                    </div>
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                  
                  <a
                    href="/reports" 
                    className="flex items-center justify-between p-3 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-primary-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm">View Reports</span>
                    </div>
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
            
            {/* Right Panel - Calculator and CSV Upload */}
            <div className="w-full lg:w-2/3">
              <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Tax Calculator</h2>
                
                {/* Always show the calculator */}
                <StockTaxCalculator initialStocks={calculatorStocks.length > 0 ? calculatorStocks : []} />
              </div>
              
              {/* CSV Upload Section */}
              <div className="bg-white shadow-sm rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Import Trading History</h2>
                
                <div className="mb-4">
                  <button
                    onClick={handleDownloadSample}
                    className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                  >
                    Download sample CSV template
                  </button>
                </div>
                
                <div className="mb-4">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".csv,.xlsx,.xls"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Upload CSV file
                  </label>
                  {uploadedFile && (
                    <span className="ml-3 text-sm text-gray-600">
                      {uploadedFile.name}
                    </span>
                  )}
                </div>
                
                {uploadError && (
                  <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
                    {uploadError}
                  </div>
                )}
                
                {processedData.length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={transferToCalculator}
                      className="bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 shadow-sm text-sm font-medium"
                    >
                      Transfer Data to Calculator
                    </button>
                    <p className="text-sm text-gray-600 mt-1">
                      {processedData.length} transactions found. Sell transactions will be transferred to the calculator.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
} 
 