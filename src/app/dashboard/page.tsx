'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getAuthTokenFromClient } from '@/lib/auth-client';
import TradeHistoryConverter from '@/components/dashboard/TradeHistoryConverter';
import StockTaxCalculator from '@/components/dashboard/StockTaxCalculator';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import TradeHistoryUploader from '@/components/dashboard/TradeHistoryUploader';

// Trade veri tipi tanımı
interface TradeData {
  ticker: string;
  transactionType: 'Buy' | 'Sell';
  numberOfShares: number;
  pricePerShare: number;
  transactionDate: string;
  totalAmount: number;
  commissionFees: number;
  buyPrice?: number;  // Alım fiyatı eklendi
  buyDate?: string;   // Alım tarihi eklendi
  sellPrice?: number; // Satım fiyatı eklendi
  sellDate?: string;  // Satım tarihi eklendi
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

export default function DashboardPage() {
  const { user, loading } = useAuth();
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
  
  // CSV Dosyası işleme
  const processCSV = async (file: File) => {
    try {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          if (results.data && Array.isArray(results.data) && results.data.length > 0) {
            setFileData(results.data);
            const processedEntries = processUploadedData(results.data);
            setProcessedData(processedEntries);
          } else {
            setUploadError("File is empty or has an invalid format");
          }
        },
        error: (error) => {
          setUploadError(error.message || "Unknown error occurred");
          alert("Error: " + error.message);
        }
      });
    } catch (err: any) {
      setUploadError(err.message || "Unknown error occurred");
      alert("Error: " + err.message);
    }
  };

  // Excel Dosyası işleme
  const processExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (Array.isArray(jsonData) && jsonData.length > 0) {
        setFileData(jsonData);
        const processedEntries = processUploadedData(jsonData);
        setProcessedData(processedEntries);
      } else {
        setUploadError("File is empty or has an invalid format");
        alert("File is empty or has an invalid format");
      }
    } catch (err: any) {
      setUploadError(err.message || "Unknown error occurred");
      alert("Error: " + err.message);
    }
  };

  // Yüklenen verileri işleme
  const processUploadedData = (data: any[]): TradeData[] => {
    const processedData: TradeData[] = [];
    
    // Sütun başlıklarını bul (farklı şekillerde yazılmış olabilir)
    const findColumn = (headers: string[], possibilities: string[]): string | null => {
      const lowerCaseHeaders = headers.map(h => h.toLowerCase());
      for (const possibility of possibilities) {
        const matchIndex = lowerCaseHeaders.findIndex(h => h.includes(possibility.toLowerCase()));
        if (matchIndex !== -1) return headers[matchIndex];
      }
      return null;
    };
    
    // Veri anahtarlarını al
    if (data.length === 0) return [];
    const headers = Object.keys(data[0]);
    
    // Olası sütun eşleştirmeleri
    const tickerColumn = findColumn(headers, ['ticker', 'symbol', 'stock', 'hisse']);
    const typeColumn = findColumn(headers, ['type', 'transaction', 'işlem', 'alım', 'satım', 'buy', 'sell', 'transaction type']);
    const sharesColumn = findColumn(headers, ['shares', 'number', 'adet', 'miktar', 'quantity', 'number of shares']);
    const priceColumn = findColumn(headers, ['price', 'fiyat', 'value', 'değer', 'price per share']);
    const dateColumn = findColumn(headers, ['date', 'tarih', 'time', 'zaman', 'transaction date']);
    const totalColumn = findColumn(headers, ['total', 'toplam', 'amount', 'tutar', 'total amount']);
    const feesColumn = findColumn(headers, ['fee', 'commission', 'ücret', 'komisyon', 'commission/fees']);
    
    // Yeni eklenen alanlar için sütunları bul
    const buyPriceColumn = findColumn(headers, ['buy price', 'alım fiyatı', 'alim fiyati']);
    const buyDateColumn = findColumn(headers, ['buy date', 'alım tarihi', 'alim tarihi']);
    const sellPriceColumn = findColumn(headers, ['sell price', 'satım fiyatı', 'satim fiyati']);
    const sellDateColumn = findColumn(headers, ['sell date', 'satım tarihi', 'satim tarihi']);
    
    // En azından ticker, işlem türü, miktar ve fiyat bilgisine ihtiyacımız var
    if (!tickerColumn || !typeColumn || !sharesColumn || !priceColumn) {
      setUploadError('Required columns not found. Please check the file format.');
      return [];
    }
    
    // Verileri işle
    data.forEach(row => {
      // İşlem türünü belirle
      let transactionType: 'Buy' | 'Sell' | null = null;
      const typeValue = String(row[typeColumn]).toLowerCase();
      
      if (['buy', 'alım', 'alim', 'al', 'b', 'long', 'purchase'].includes(typeValue)) {
        transactionType = 'Buy';
      } else if (['sell', 'satım', 'satim', 'sat', 's', 'short', 'sale'].includes(typeValue)) {
        transactionType = 'Sell';
      }
      
      // Sadece anlamlı verileri ekle
      if (row[tickerColumn] && transactionType) {
        processedData.push({
          ticker: String(row[tickerColumn]),
          transactionType,
          numberOfShares: parseFloat(String(row[sharesColumn])) || 0,
          pricePerShare: parseFloat(String(row[priceColumn])) || 0,
          transactionDate: dateColumn ? String(row[dateColumn]) : '',
          totalAmount: totalColumn ? parseFloat(String(row[totalColumn])) || 0 : 0,
          commissionFees: feesColumn ? parseFloat(String(row[feesColumn])) || 0 : 0,
          buyPrice: buyPriceColumn ? parseFloat(String(row[buyPriceColumn])) || 0 : 0,
          buyDate: buyDateColumn ? String(row[buyDateColumn]) : '',
          sellPrice: sellPriceColumn ? parseFloat(String(row[sellPriceColumn])) || 0 : 0,
          sellDate: sellDateColumn ? String(row[sellDateColumn]) : ''
        });
      }
    });
    
    return processedData;
  };

  // Dosya yükleme işleyicisi
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploadedFile(file);
    setUploadError(null);
    
    // Dosya tipine göre işle
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      processCSV(file);
    } else if (
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')
    ) {
      processExcel(file);
    } else {
      setUploadError('Please upload a CSV or Excel file');
      alert('Please upload a CSV or Excel file');
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
      holdingPeriod: hesaplaHoldingPeriod(item.buyDate || item.transactionDate, item.sellDate || item.transactionDate),
    }));
    setCalculatorStocks(stocks);
    alert('Data successfully transferred to the tax calculator');
  };

  // Alış ve satış tarihinden ay farkını hesapla
  function hesaplaHoldingPeriod(buyDateStr?: string, sellDateStr?: string) {
    if (!buyDateStr || !sellDateStr) return 0;
    
    try {
      const buyDate = new Date(buyDateStr);
      const sellDate = new Date(sellDateStr);
      
      // Geçerli tarihler mi kontrol et
      if (isNaN(buyDate.getTime()) || isNaN(sellDate.getTime())) {
        return 0;
      }
      
      return (sellDate.getFullYear() - buyDate.getFullYear()) * 12 + (sellDate.getMonth() - buyDate.getMonth());
    } catch (error) {
      console.error("Tarih dönüştürme hatası:", error);
      return 0;
    }
  }

  // Handle CSV sample download
  const handleDownloadSample = () => {
    const sampleCSVContent = `Symbol,Transaction Type,Number of Shares,Price Per Share,Transaction Date,Total Amount,Commission/Fees,Buy Price,Buy Date,Sell Price,Sell Date
AAPL,Buy,10,150.25,2023-01-15,1502.50,7.99,150.25,2023-01-15,,
AAPL,Sell,5,180.75,2023-06-20,903.75,7.99,150.25,2023-01-15,180.75,2023-06-20
MSFT,Buy,8,270.50,2023-02-10,2164.00,7.99,270.50,2023-02-10,,
MSFT,Sell,4,320.45,2023-08-15,1281.80,7.99,270.50,2023-02-10,320.45,2023-08-15
GOOGL,Buy,2,2450.75,2023-03-10,4901.50,7.99,2450.75,2023-03-10,,`;

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

  // Sayfa yüklendiğinde localStorage'a isLoggedIn değerini ayarla
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('Dashboard page loaded, setting localStorage isLoggedIn=true');
      localStorage.setItem('isLoggedIn', 'true');
    }
  }, []);

  useEffect(() => {
    console.log('DashboardPage useEffect running, loading:', loading, 'user:', user);
    
    // Token varsa yükleme durumunu sonlandır
    const token = getAuthTokenFromClient();
    if (token) {
      console.log('Token found, loading page');
      setPageLoading(false);
      return;
    }
    
    // Token yoksa normal kontrol mekanizmasını çalıştır
    if (!loading) {
      if (!user) {
        console.log('User is not logged in, redirecting to login page');
        router.push('/login');
      } else {
        console.log('User is logged in, loading page');
        setPageLoading(false);
      }
    }
  }, [user, loading, router]);

  // Token var mı kontrol et ve varsa sayfayı göster
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

  // Token var ama user yok, kullanıcı bilgilerini geçici olarak oluştur
  const userName = user?.name || 'User';

  return (
    <>
      <Navbar />
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Panel */}
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
                <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Trading History Converter</h2>
                  <button
                    onClick={() => setIsTradeHistoryOpen(!isTradeHistoryOpen)}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    {isTradeHistoryOpen ? 'Collapse' : 'Expand'}
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className={`h-4 w-4 ml-1 transition-transform duration-200 ${isTradeHistoryOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                
                <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm transition-all duration-300 ${isTradeHistoryOpen ? 'fixed inset-0 z-50 m-8 overflow-auto' : ''}`}>
                  {isTradeHistoryOpen && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setIsTradeHistoryOpen(false)}
                        className="bg-white rounded-full p-2 hover:bg-gray-100"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  
                  <p className="text-gray-600 text-sm mb-4">
                    Upload your trading history in CSV or Excel format to convert it to the format needed for tax calculations.
                  </p>
                  
                  {!processedData.length ? (
                    <div className="trade-history-uploader-wrapper">
                      {/* @ts-ignore */}
                      <TradeHistoryUploader 
                        onDataProcessed={(data) => {
                          setProcessedData(data);
                          setUploadedFile(null);
                          setIsTradeHistoryOpen(true); // Open the panel when data is processed
                        }} 
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-green-600 font-medium">
                          {processedData.length} transactions found
                        </p>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setProcessedData([])}
                            className="text-xs border border-gray-300 px-3 py-1 rounded hover:bg-gray-50"
                          >
                            Upload Another File
                          </button>
                          <button
                            onClick={() => {
                              transferToCalculator();
                              setIsTradeHistoryOpen(false); // Close the panel after transfer
                            }}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                          >
                            Transfer to Calculator
                          </button>
                        </div>
                      </div>
                      
                      <div className={`overflow-y-auto text-xs border border-gray-200 rounded p-2 ${isTradeHistoryOpen ? 'max-h-[calc(100vh-200px)]' : 'max-h-40'} relative`}>
                        {!isTradeHistoryOpen && (
                          <button
                            onClick={() => setIsTradeHistoryOpen(true)}
                            className="absolute top-2 right-2 bg-white bg-opacity-80 rounded-full p-1 shadow-sm hover:bg-gray-100 transition-colors"
                            title="Expand view"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          </button>
                        )}
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Symbol</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Type</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Shares</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Price</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Date</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Buy Price</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Buy Date</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Sell Price</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Sell Date</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Total</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Fees</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {(isTradeHistoryOpen ? processedData : processedData.slice(0, 5)).map((item, index) => (
                              <tr key={index}>
                                <td className="px-2 py-1">{item.ticker}</td>
                                <td className="px-2 py-1">{item.transactionType}</td>
                                <td className="px-2 py-1">{item.numberOfShares}</td>
                                <td className="px-2 py-1">${item.pricePerShare.toFixed(2)}</td>
                                <td className="px-2 py-1">{item.transactionDate}</td>
                                <td className="px-2 py-1">${item.buyPrice ? item.buyPrice.toFixed(2) : '0.00'}</td>
                                <td className="px-2 py-1">{item.buyDate || '-'}</td>
                                <td className="px-2 py-1">${item.sellPrice ? item.sellPrice.toFixed(2) : '0.00'}</td>
                                <td className="px-2 py-1">{item.sellDate || '-'}</td>
                                <td className="px-2 py-1">${item.totalAmount ? item.totalAmount.toFixed(2) : (item.numberOfShares * item.pricePerShare).toFixed(2)}</td>
                                <td className="px-2 py-1">${item.commissionFees ? item.commissionFees.toFixed(2) : '0.00'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!isTradeHistoryOpen && processedData.length > 5 && (
                          <div className="text-center bg-gray-50 py-1.5 mt-1 rounded border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setIsTradeHistoryOpen(true)}>
                            <p className="text-gray-600 text-xs font-medium flex items-center justify-center">
                              {processedData.length - 5} more transactions
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                          </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4 text-xs text-gray-500">
                    <p className="font-medium mb-1">Note:</p>
                    <p>Your file should include columns for stock symbol, transaction type (buy/sell), number of shares, and price per share. For best results, include transaction date, total amount, and commission/fees.</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
                
                <div className="grid grid-cols-1 gap-3">
                  <button
                    className="flex items-center justify-between p-3 border border-gray-300 rounded-md hover:bg-gray-50"
                    onClick={() => router.push('/transactions/new')}
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
                  </button>
                  
                  <button
                    className="flex items-center justify-between p-3 border border-gray-300 rounded-md hover:bg-gray-50"
                    onClick={() => router.push('/reports')}
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
                  </button>
                </div>
              </div>
            </div>
            
            {/* Right Panel */}
            <div className="w-full lg:w-2/3">
              <StockTaxCalculator initialStocks={calculatorStocks} />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
} 
 