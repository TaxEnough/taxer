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
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const [taxableIncome, setTaxableIncome] = useState<string>('');
  const [stocks, setStocks] = useState<Array<{id: string, symbol: string, purchasePrice: string, sellingPrice: string, sharesSold: string, tradingFees: string, holdingPeriod: string, gainLoss: number}>>([
    {
      id: '1',
      symbol: 'AAPL',
      purchasePrice: '',
      sellingPrice: '',
      sharesSold: '',
      tradingFees: '',
      holdingPeriod: '',
      gainLoss: 0
    }
  ]);
  
  // Dosya yükleme state'leri
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<any[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<TradeData[]>([]);
  
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
    const typeColumn = findColumn(headers, ['type', 'transaction', 'işlem', 'alım', 'satım', 'buy', 'sell']);
    const sharesColumn = findColumn(headers, ['shares', 'number', 'adet', 'miktar', 'quantity']);
    const priceColumn = findColumn(headers, ['price', 'fiyat', 'value', 'değer']);
    const dateColumn = findColumn(headers, ['date', 'tarih', 'time', 'zaman']);
    const totalColumn = findColumn(headers, ['total', 'toplam', 'amount', 'tutar']);
    const feesColumn = findColumn(headers, ['fee', 'commission', 'ücret', 'komisyon']);
    
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
          commissionFees: feesColumn ? parseFloat(String(row[feesColumn])) || 0 : 0
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
    // En az bir veri olduğunu kontrol et
    if (!processedData.length) {
      alert('No data to transfer');
      return;
    }
    
    // İşlem türü 'Sell' olanları bul
    const sellTransactions = processedData.filter(data => data.transactionType === 'Sell');
    
    if (sellTransactions.length === 0) {
      alert('No sell transactions found to transfer');
      return;
    }
    
    // Her satış işlemi için bir satır ekle
    const newStocks = sellTransactions.map(transaction => {
      // Karşılık gelen alım işlemini bul (aynı hisse senedi için)
      const buyTransaction = processedData.find(
        data => data.transactionType === 'Buy' && data.ticker === transaction.ticker
      );
      
      // Basit bir ID oluştur
      const id = new Date().getTime().toString() + Math.random().toString(36).substring(2, 9);
      
      // Holding period (ay olarak) - tarihler varsa hesapla, yoksa boş bırak
      let holdingPeriod = '';
      if (buyTransaction?.transactionDate && transaction.transactionDate) {
        try {
          const buyDate = new Date(buyTransaction.transactionDate);
          const sellDate = new Date(transaction.transactionDate);
          const diffMs = sellDate.getTime() - buyDate.getTime();
          const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
          holdingPeriod = String(diffMonths);
        } catch (e) {
          // Tarih hesaplama hatası, boş bırak
        }
      }
      
      const newStock = {
        id,
        symbol: transaction.ticker,
        purchasePrice: buyTransaction ? String(buyTransaction.pricePerShare) : '',
        sellingPrice: String(transaction.pricePerShare),
        sharesSold: String(transaction.numberOfShares),
        tradingFees: String(transaction.commissionFees),
        holdingPeriod,
        gainLoss: calculateGainLoss({
          purchasePrice: buyTransaction ? String(buyTransaction.pricePerShare) : '0',
          sellingPrice: String(transaction.pricePerShare),
          sharesSold: String(transaction.numberOfShares),
          tradingFees: String(transaction.commissionFees)
        })
      };
      
      return newStock;
    });
    
    // Mevcut stokları sil ve yenileri ekle
    setStocks(newStocks);
  };

  // Helper function to calculate gain/loss
  const calculateGainLoss = (stock: any) => {
    const purchase = parseFloat(stock.purchasePrice) || 0;
    const selling = parseFloat(stock.sellingPrice) || 0;
    const shares = parseFloat(stock.sharesSold) || 0;
    const fees = parseFloat(stock.tradingFees) || 0;
    
    return ((selling - purchase) * shares) - fees;
  };

  // Function to add new stock row
  const addStock = () => {
    const newId = new Date().getTime().toString();
    setStocks([...stocks, {
      id: newId,
      symbol: '',
      purchasePrice: '',
      sellingPrice: '',
      sharesSold: '',
      tradingFees: '',
      holdingPeriod: '',
      gainLoss: 0
    }]);
  };

  // Function to remove a stock row
  const removeStock = (id: string) => {
    if (stocks.length <= 1) {
      // Reset the only row instead of removing it
      setStocks([{
        id: '1',
        symbol: '',
        purchasePrice: '',
        sellingPrice: '',
        sharesSold: '',
        tradingFees: '',
        holdingPeriod: '',
        gainLoss: 0
      }]);
    } else {
      setStocks(stocks.filter(stock => stock.id !== id));
    }
  };

  // Function to handle stock input changes
  const handleStockChange = (id: string, field: string, value: string) => {
    setStocks(stocks.map(stock => {
      if (stock.id === id) {
        const updatedStock = { ...stock, [field]: value };
        // Recalculate gain/loss
        updatedStock.gainLoss = calculateGainLoss(updatedStock);
        return updatedStock;
      }
      return stock;
    }));
  };

  // Function to calculate taxes
  const calculateTax = () => {
    if (!taxableIncome || parseFloat(taxableIncome) <= 0) {
      alert('Please enter your taxable income');
      return;
    }

    // Check if at least one stock has complete data
    const hasCompleteData = stocks.some(stock => 
      stock.symbol && 
      stock.purchasePrice && 
      stock.sellingPrice && 
      stock.sharesSold && 
      stock.holdingPeriod
    );

    if (!hasCompleteData) {
      alert('Please enter complete information for at least one stock');
      return;
    }

    alert('Tax calculation will be available in the next update');
  };

  // Handle CSV sample download
  const handleDownloadSample = () => {
    const sampleCSVContent = `Symbol,Transaction Type,Date,Shares,Price,Total Amount,Fees
AAPL,Buy,2023-01-15,10,150.25,1502.50,7.99
MSFT,Sell,2023-07-20,5,320.45,1602.25,7.99
GOOGL,Buy,2023-03-10,2,2450.75,4901.50,7.99`;

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
                <h2 className="text-lg font-medium text-gray-900 mb-4">Trading History Converter</h2>
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
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
                            onClick={transferToCalculator}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                          >
                            Transfer to Calculator
                          </button>
                        </div>
                      </div>
                      
                      <div className="max-h-40 overflow-y-auto text-xs border border-gray-200 rounded p-2">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Symbol</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Type</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Shares</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Price</th>
                              <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Date</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {processedData.slice(0, 5).map((item, index) => (
                              <tr key={index}>
                                <td className="px-2 py-1">{item.ticker}</td>
                                <td className="px-2 py-1">{item.transactionType}</td>
                                <td className="px-2 py-1">{item.numberOfShares}</td>
                                <td className="px-2 py-1">${item.pricePerShare.toFixed(2)}</td>
                                <td className="px-2 py-1">{item.transactionDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {processedData.length > 5 && (
                          <p className="text-center text-gray-500 mt-1">
                            And {processedData.length - 5} more transactions...
                          </p>
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
            <div className="w-full lg:w-2/3 bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-5">US Stock Tax Calculator (2024)</h2>
              
              <div className="mb-4 bg-blue-50 p-2.5 rounded border border-blue-100">
                <label htmlFor="income" className="block text-sm font-medium text-gray-700 mb-1">
                  Total Taxable Income ($)
                </label>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-600 mr-1.5">$</span>
                  <input
                    type="text"
                    id="income"
                    placeholder="Enter your taxable income"
                    className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full text-sm py-1 px-2 border-gray-300 rounded-md bg-white"
                    value={taxableIncome}
                    onChange={(e) => setTaxableIncome(e.target.value)}
                  />
                </div>
                <p className="text-xs text-blue-600 mt-1 italic">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Excluding investment income
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 mb-4">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Price ($)</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selling Price ($)</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shares Sold</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trading Fees ($)</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holding Period (months)</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gain/Loss</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stocks.map(stock => (
                      <tr key={stock.id}>
                        <td className="px-4 py-2">
                          <input 
                            className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full text-xs" 
                            placeholder="AAPL" 
                            value={stock.symbol}
                            onChange={(e) => handleStockChange(stock.id, 'symbol', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full text-xs" 
                            placeholder="Price" 
                            type="number"
                            value={stock.purchasePrice}
                            onChange={(e) => handleStockChange(stock.id, 'purchasePrice', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full text-xs" 
                            placeholder="Price" 
                            type="number"
                            value={stock.sellingPrice}
                            onChange={(e) => handleStockChange(stock.id, 'sellingPrice', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full text-xs" 
                            placeholder="Shares" 
                            type="number"
                            value={stock.sharesSold}
                            onChange={(e) => handleStockChange(stock.id, 'sharesSold', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full text-xs" 
                            placeholder="Fees" 
                            type="number"
                            value={stock.tradingFees}
                            onChange={(e) => handleStockChange(stock.id, 'tradingFees', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full text-xs" 
                            placeholder="Months" 
                            type="number"
                            value={stock.holdingPeriod}
                            onChange={(e) => handleStockChange(stock.id, 'holdingPeriod', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">{stock.gainLoss ? `$${stock.gainLoss.toFixed(2)}` : '$0.00'}</td>
                        <td className="px-4 py-2 text-center">
                          <button 
                            className="text-red-600 hover:text-red-900"
                            onClick={() => removeStock(stock.id)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
                <button 
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  onClick={addStock}
                >
                  + Add Stock
                </button>
                <button 
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  onClick={calculateTax}
                >
                  Calculate Tax
                </button>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="font-medium text-gray-900 mb-2">Tax Calculation Results</h3>
                <p className="text-sm text-gray-500">Enter your information and click Calculate Tax to see your estimated tax liability</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
} 
 