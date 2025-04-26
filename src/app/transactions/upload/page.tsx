'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { parse } from 'papaparse';
import * as XLSX from 'xlsx';
import { getAuthTokenFromClient } from '@/lib/auth-client';

// İşlem verisini tanımlama
interface ParsedTransaction {
  [key: string]: any;
}

// Sütun eşleştirme
interface ColumnMapping {
  ticker: string;
  transactionType: string;
  numberOfShares: string;
  sharePrice: string;
  date: string;
  fees: string;
  notes: string;
}

export default function UploadTransactions() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileData, setFileData] = useState<ParsedTransaction[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isFileLoaded, setIsFileLoaded] = useState<boolean>(false);
  const [selectedRows, setSelectedRows] = useState<ParsedTransaction[]>([]);
  
  // Sütun eşleştirme
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    ticker: '',
    transactionType: '',
    numberOfShares: '',
    sharePrice: '',
    date: '',
    fees: '',
    notes: ''
  });
  
  const router = useRouter();
  const { toast } = useToast();

  // Standart sütun adları (varyasyonları içerir)
  const standardColumns = {
    ticker: ['ticker', 'symbol', 'stock', 'hisse', 'sembol', 'kod', 'code'],
    transactionType: ['transaction type', 'type', 'transaction', 'trade type', 'işlem türü', 'tip', 'işlem', 'buy/sell', 'alım/satım', 'alim/satim'],
    numberOfShares: ['number of shares', 'shares', 'quantity', 'amount', 'adet', 'hisse adedi', 'miktar'],
    sharePrice: ['price per share', 'price', 'share price', 'unit price', 'birim fiyat', 'fiyat', 'hisse fiyatı'],
    date: ['transaction date', 'date', 'trade date', 'tarih', 'işlem tarihi'],
    fees: ['commission', 'fees', 'fee', 'komisyon', 'ücret', 'komisyon ücreti'],
    notes: ['notes', 'note', 'comment', 'not', 'açıklama', 'yorum']
  };

  // Dosyayı ön işleme
  const processInitialFile = (data: ParsedTransaction[], headers: string[]) => {
    setFileData(data);
    setHeaders(headers);
    
    // Otomatik sütun eşleştirme
    const newMapping: ColumnMapping = {
      ticker: '',
      transactionType: '',
      numberOfShares: '',
      sharePrice: '',
      date: '',
      fees: '',
      notes: ''
    };
    
    // Her başlık için potansiyel eşleşme bul
    headers.forEach(header => {
      const headerLower = header.toLowerCase().trim();
      
      // Her standart sütun için kontrol et
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
  
  // CSV dosyasını işleme
  const processCSV = (file: File) => {
    parse(file, {
      header: true,
      complete: (results) => {
        try {
          if (!results.data || !Array.isArray(results.data) || results.data.length === 0) {
            throw new Error('Geçersiz CSV dosya formatı');
          }
          
          const headers = results.meta.fields || [];
          if (headers.length === 0) {
            throw new Error('CSV dosyasında sütun başlıkları bulunamadı');
          }

          processInitialFile(results.data as ParsedTransaction[], headers);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Dosya işlenirken hata oluştu');
          setIsAnalyzing(false);
        }
      },
      error: (error) => {
        setError(`Dosya okuma hatası: ${error.message}`);
        setIsAnalyzing(false);
      }
    });
  };

  // Excel dosyasını işleme
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
            throw new Error('Excel dosyasında yeterli veri bulunamadı');
          }

          // Başlıkları al
          const sampleData = jsonData[0] as Record<string, unknown>;
          const headers = Object.keys(sampleData);
          
          processInitialFile(jsonData as ParsedTransaction[], headers);
          setError(null);
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Excel dosyası işlenirken hata oluştu');
          setIsAnalyzing(false);
        }
      };
      reader.onerror = (error) => {
        setError('Dosya okuma hatası');
        setIsAnalyzing(false);
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Excel dosyası işlenirken hata oluştu');
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
        setError('Desteklenmeyen dosya formatı. Lütfen CSV veya Excel dosyası yükleyin.');
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
        setError('Desteklenmeyen dosya formatı. Lütfen CSV veya Excel dosyası yükleyin.');
        setIsAnalyzing(false);
      }
    }
  };

  // Sütun eşleştirme değişikliklerini izle
  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Satır seçimi işleme
  const toggleRowSelection = (index: number) => {
    if (selectedRows.includes(fileData[index])) {
      setSelectedRows(selectedRows.filter(row => row !== fileData[index]));
    } else {
      setSelectedRows([...selectedRows, fileData[index]]);
    }
  };

  // Tüm satırları seç/kaldır
  const toggleAllRows = () => {
    if (selectedRows.length === fileData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows([...fileData]);
    }
  };

  // Seçilen satırları işleme ve kaydetme
  const processSelectedRows = async () => {
    // Tüm gerekli alanlar eşleştirildi mi kontrol et
    const requiredFields: (keyof ColumnMapping)[] = ['ticker', 'transactionType', 'numberOfShares', 'sharePrice', 'date'];
    const missingFields = requiredFields.filter(field => !columnMapping[field]);
    
    if (missingFields.length > 0) {
      setError(`Please map the following fields: ${missingFields.join(', ')}`);
      return;
    }

    if (selectedRows.length === 0) {
      setError('Please select at least one row');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Veriyi dönüştür
      const processedTransactions = selectedRows.map(row => {
        // İşlem türünü belirle
        let transactionType = row[columnMapping.transactionType]?.toString().toLowerCase() || '';
        let standardType = 'buy'; // Varsayılan olarak alış
        
        if (['buy', 'alım', 'alim', 'al', 'b', 'long', 'purchase'].includes(transactionType)) {
          standardType = 'buy';
        } else if (['sell', 'satım', 'satim', 'sat', 's', 'short', 'sale'].includes(transactionType)) {
          standardType = 'sell';
        }
        
        return {
          ticker: row[columnMapping.ticker]?.toString().toUpperCase() || '',
          type: standardType,
          shares: parseFloat(row[columnMapping.numberOfShares]?.toString() || '0'),
          price: parseFloat(row[columnMapping.sharePrice]?.toString() || '0'),
          date: row[columnMapping.date]?.toString() || new Date().toISOString().split('T')[0],
          fee: parseFloat(row[columnMapping.fees]?.toString() || '0'),
          notes: row[columnMapping.notes]?.toString() || ''
        };
      });

      // Token al
      const token = getAuthTokenFromClient();
      
      if (!token) {
        throw new Error('Your session may have expired. Please login again.');
      }

      // API'ye gönder
      const response = await fetch('/api/transactions/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transactions: processedTransactions }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'An error occurred while saving transactions.');
      }

      const result = await response.json();
      setSuccess(`${result.count || processedTransactions.length} transactions successfully saved.`);
      toast({
        title: 'Success',
        description: `${result.count || processedTransactions.length} transactions successfully saved.`,
      });
      
      // 2 saniye sonra işlemler sayfasına yönlendir
      setTimeout(() => {
        router.push('/transactions');
      }, 2000);
      
    } catch (err) {
      console.error('Error saving transactions:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while saving transactions.');
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred while saving transactions.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Upload Transactions</h1>
        <Button variant="outline" onClick={() => router.push('/transactions')}>
          Go Back
        </Button>
      </div>

      {!isFileLoaded ? (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div 
            className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer mb-5 hover:bg-gray-50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mb-1">Drag your file here or click to select</p>
            <p className="text-sm text-gray-500">CSV or Excel (.xlsx, .xls) formats are supported</p>
            <input 
              id="file-upload" 
              type="file" 
              className="hidden" 
              accept=".csv,.xlsx,.xls" 
              onChange={handleFileChange}
            />
          </div>
          
          {isAnalyzing && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500 mx-auto"></div>
              <p className="mt-2">Analyzing file...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Column Mapping</h2>
            <p className="text-sm text-gray-600 mb-4">Match the columns from your file with transaction fields</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.keys(columnMapping).map((field) => (
                <div key={field} className="mb-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field === 'ticker' ? 'Stock Symbol' : 
                     field === 'transactionType' ? 'Transaction Type' :
                     field === 'numberOfShares' ? 'Number of Shares' :
                     field === 'sharePrice' ? 'Share Price' :
                     field === 'date' ? 'Date' :
                     field === 'fees' ? 'Fees' :
                     field === 'notes' ? 'Notes' : field}
                    {['ticker', 'transactionType', 'numberOfShares', 'sharePrice', 'date'].includes(field) && ' *'}
                  </label>
                  <select
                    value={columnMapping[field as keyof ColumnMapping]}
                    onChange={(e) => handleMappingChange(field as keyof ColumnMapping, e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  >
                    <option value="">Select...</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">Preview</h2>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === fileData.length}
                    onChange={toggleAllRows}
                    className="rounded text-primary-600 mr-2"
                  />
                  Select All ({selectedRows.length}/{fileData.length})
                </label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Seç
                    </th>
                    {headers.map((header) => (
                      <th key={header} scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fileData.slice(0, 10).map((row, index) => (
                    <tr key={index} className={selectedRows.includes(row) ? 'bg-blue-50' : ''}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(row)}
                          onChange={() => toggleRowSelection(index)}
                          className="rounded text-primary-600"
                        />
                      </td>
                      {headers.map((header) => (
                        <td key={header} className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {row[header]?.toString() || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {fileData.length > 10 && (
                    <tr>
                      <td colSpan={headers.length + 1} className="px-3 py-2 text-sm text-gray-500 text-center">
                        {fileData.length - 10} satır daha...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
              <p className="font-medium">Success</p>
              <p>{success}</p>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <Button 
              onClick={processSelectedRows} 
              disabled={loading || selectedRows.length === 0}
              className="w-full"
            >
              {loading ? 'İşleniyor...' : `Seçilen İşlemleri Kaydet (${selectedRows.length})`}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsFileLoaded(false);
                setFile(null);
                setFileData([]);
                setHeaders([]);
                setSelectedRows([]);
                setError(null);
                setSuccess(null);
              }}
              className="w-1/3"
            >
              İptal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 