'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface TradeData {
  ticker: string;
  transactionType: 'Buy' | 'Sell';
  numberOfShares: number;
  pricePerShare: number;
  transactionDate: string;
  totalAmount: number;
  commissionFees: number;
}

interface ColumnMapping {
  ticker: string;
  transactionType: string;
  numberOfShares: string;
  pricePerShare: string;
  transactionDate: string;
  totalAmount: string;
  commissionFees: string;
}

interface TradeHistoryUploaderProps {
  onDataProcessed: (data: TradeData[]) => void;
}

const TradeHistoryUploader: React.FC<TradeHistoryUploaderProps> = ({ onDataProcessed }) => {
  const [fileData, setFileData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isFileLoaded, setIsFileLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    ticker: '',
    transactionType: '',
    numberOfShares: '',
    pricePerShare: '',
    transactionDate: '',
    totalAmount: '',
    commissionFees: ''
  });

  // Standart sütun adları (varyasyonları içerir)
  const standardColumns = {
    ticker: ['ticker', 'symbol', 'stock', 'hisse', 'sembol', 'kod', 'code'],
    transactionType: ['transaction type', 'type', 'transaction', 'trade type', 'işlem türü', 'tip', 'işlem', 'buy/sell', 'alım/satım', 'alim/satim'],
    numberOfShares: ['number of shares', 'shares', 'quantity', 'amount', 'adet', 'hisse adedi', 'miktar'],
    pricePerShare: ['price per share', 'price', 'share price', 'unit price', 'birim fiyat', 'fiyat', 'hisse fiyatı'],
    transactionDate: ['transaction date', 'date', 'trade date', 'tarih', 'işlem tarihi'],
    totalAmount: ['total amount', 'total', 'value', 'toplam tutar', 'toplam', 'değer'],
    commissionFees: ['commission/fees', 'commission', 'fees', 'komisyon', 'ücret', 'komisyon/ücret']
  };

  // Dosyayı ilk işleme ve sütunları otomatik eşleştirme
  const processInitialFile = (data: any[], headers: string[]) => {
    setFileData(data);
    setHeaders(headers);
    
    // Otomatik sütun eşleştirmeyi dene
    const newMapping: ColumnMapping = {
      ticker: '',
      transactionType: '',
      numberOfShares: '',
      pricePerShare: '',
      transactionDate: '',
      totalAmount: '',
      commissionFees: ''
    };
    
    // Her başlık için potansiyel eşleşme bul
    headers.forEach(header => {
      const headerLower = header.toLowerCase().trim();
      
      // Her standart sütun için kontrol et
      Object.entries(standardColumns).forEach(([key, possibleNames]) => {
        if (possibleNames.some(name => headerLower.includes(name.toLowerCase()))) {
          newMapping[key as keyof ColumnMapping] = header;
        }
      });
    });
    
    setColumnMapping(newMapping);
    setIsFileLoaded(true);
  };
  
  // CSV dosyasını işleme
  const processCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (!results.data || !Array.isArray(results.data) || results.data.length === 0) {
            throw new Error('Invalid CSV file format');
          }
          
          const headers = results.meta.fields || [];
          if (headers.length === 0) {
            throw new Error('Could not find column headers in CSV file');
          }

          console.log('CSV Parsed successfully:', { rowCount: results.data.length, headers });
          processInitialFile(results.data as any[], headers);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error processing file');
        }
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        setError(`File reading error: ${error.message}`);
      }
    });
  };

  // Excel dosyasını işleme
  const processExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 'A', defval: '' });
      
      if (jsonData.length < 2) {
        throw new Error('Not enough data found in Excel file');
      }

      // İlk satırı başlık olarak al (Excel'de A1, B1, C1, ...)
      const firstRow = jsonData[0] as Record<string, unknown>;
      const headers = Object.values(firstRow).map(String);
      
      // İlk satırı kaldır ve kalan verileri işle
      const rows = jsonData.slice(1);
      
      console.log('Excel Parsed successfully:', { rowCount: rows.length, headers });
      processInitialFile(rows, headers);
      setError(null);
    } catch (err) {
      console.error('Excel parsing error:', err);
      setError(err instanceof Error ? err.message : 'Error processing Excel file');
    }
  };

  // Veriyi son haline getir ve ilet
  const processMappedData = () => {
    // Tüm gerekli alanlar eşleştirildi mi kontrol et
    const requiredFields: (keyof ColumnMapping)[] = ['ticker', 'transactionType', 'numberOfShares', 'pricePerShare'];
    const missingFields = requiredFields.filter(field => !columnMapping[field]);
    
    if (missingFields.length > 0) {
      setError(`Please map the following required fields: ${missingFields.join(', ')}`);
      return;
    }

    try {
      const processedData: TradeData[] = [];
      let processedRowCount = 0;
      let invalidRows = 0;
      
      // Her satırı işlemeye çalış, belirli alanlar eksik olabilir
      fileData.forEach((row: any, index: number) => {
        // Satır boş veya geçersiz mi kontrol et
        if (!row || typeof row !== 'object') {
          console.log(`Skipping row ${index}: Not an object`, row);
          return;
        }
        
        // Ticker/Symbol bilgisini kontrol et - herhangi bir değeri kabul et
        const tickerValue = row[columnMapping.ticker];
        // Değer varsa kabul et, yoksa boş string olarak değerlendir
        const ticker = tickerValue != null ? String(tickerValue).trim() : '';
        
        // İşlem türünü kontrol et - kullanıcının seçtiği sütundan değeri al
        const transactionTypeValue = row[columnMapping.transactionType];
        // Değer varsa kabul et, yoksa boş string olarak değerlendir
        const transactionTypeStr = transactionTypeValue != null ? String(transactionTypeValue).trim().toLowerCase() : '';
        
        // İşlem türünü tahmin et (buy veya sell)
        // Burada daha geniş bir kelime eşleştirmesi yapıyoruz
        let standardType: 'Buy' | 'Sell' | null = null;
        
        // Alım işlemleri için kontrol
        if (transactionTypeStr === '' || 
            transactionTypeStr.includes('buy') || 
            transactionTypeStr.includes('alım') || 
            transactionTypeStr.includes('alim') || 
            transactionTypeStr.includes('al') ||
            transactionTypeStr === 'b' ||
            transactionTypeStr.includes('long') || 
            transactionTypeStr.includes('purchase')) {
          standardType = 'Buy';
        } 
        // Satım işlemleri için kontrol
        else if (transactionTypeStr.includes('sell') || 
                transactionTypeStr.includes('satım') || 
                transactionTypeStr.includes('satim') || 
                transactionTypeStr.includes('sat') ||
                transactionTypeStr === 's' ||
                transactionTypeStr.includes('short') || 
                transactionTypeStr.includes('sale')) {
          standardType = 'Sell';
        }
        // Sayısal kontrol (1=Alım, 2=Satım gibi)
        else if (transactionTypeStr === '1' || transactionTypeStr === '0') {
          standardType = 'Buy';
        }
        else if (transactionTypeStr === '2') {
          standardType = 'Sell';
        }
        // Varsayılan olarak "Buy" kabul et
        else {
          // Tanımlanamayan işlem türü varsayılan olarak Buy olarak kabul edilir
          standardType = 'Buy';
          console.log(`Row ${index}: Unrecognized transaction type "${transactionTypeStr}", defaulting to Buy`);
        }
        
        // Hisse adedi ve fiyat bilgilerini kontrol et
        const sharesValue = row[columnMapping.numberOfShares];
        const priceValue = row[columnMapping.pricePerShare];
        
        // Her iki alan da dolu mu kontrol et
        // Ticker boş olsa bile devam et - bazı kullanıcılar sembol girmeyebilir
        if (ticker || standardType) {
          processedRowCount++;
          
          // Sayısal değerleri dönüştür
          const numberOfShares = parseFloatSafe(sharesValue);
          const pricePerShare = parseFloatSafe(priceValue);
          
          // Tarihi kontrol et
          let transactionDate = '';
          if (columnMapping.transactionDate && row[columnMapping.transactionDate] != null) {
            transactionDate = String(row[columnMapping.transactionDate]);
          }
          
          // Toplam tutar
          let totalAmount = 0;
          if (columnMapping.totalAmount && row[columnMapping.totalAmount] != null) {
            totalAmount = parseFloatSafe(row[columnMapping.totalAmount]);
          }
          
          // Komisyon
          let commissionFees = 0;
          if (columnMapping.commissionFees && row[columnMapping.commissionFees] != null) {
            commissionFees = parseFloatSafe(row[columnMapping.commissionFees]);
          }
          
          // Ticker özel olarak boş bırakılmışsa varsayılan bir değer ata
          const finalTicker = ticker || `Stock${index + 1}`;
          
          // Veriyi ekle
          processedData.push({
            ticker: finalTicker,
            transactionType: standardType,
            numberOfShares: numberOfShares,
            pricePerShare: pricePerShare,
            transactionDate: transactionDate,
            totalAmount: totalAmount,
            commissionFees: commissionFees
          });
        } else {
          invalidRows++;
          console.log(`Row ${index}: Invalid row - missing required values`, { 
            ticker: tickerValue, 
            transactionType: transactionTypeValue,
            shares: sharesValue,
            price: priceValue 
          });
        }
      });

      // Debug - işlem sürecini logla
      console.log(`Processing summary - Total rows: ${fileData.length}, Valid: ${processedData.length}, Invalid: ${invalidRows}`);

      if (processedData.length === 0) {
        if (invalidRows > 0) {
          setError(`Found ${invalidRows} rows but could not process them. Please check the data in your file. Each row should have a transaction type and ticker symbol.`);
        } else {
          setError('No valid transaction data found in the file. Please check the file format and content.');
        }
        return;
      }

      // Başarıyla işlenen verileri aktar
      onDataProcessed(processedData);
      setIsFileLoaded(false);
      setError(null);
    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? `Error: ${err.message}` : 'Error processing data');
    }
  };
  
  // Güvenli sayı dönüşümü yardımcı fonksiyonu
  const parseFloatSafe = (value: any): number => {
    if (value === null || value === undefined) return 0;
    
    // String'e çevir
    const strValue = String(value).trim();
    
    // Boş ise 0 döndür
    if (!strValue) return 0;
    
    // Sayıya çevir
    const parsed = parseFloat(strValue);
    
    // NaN kontrolü
    return isNaN(parsed) ? 0 : parsed;
  };

  // Dosya bırakma
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsFileLoaded(false);
    setHeaders([]);
    setFileData([]);
    setColumnMapping({
      ticker: '',
      transactionType: '',
      numberOfShares: '',
      pricePerShare: '',
      transactionDate: '',
      totalAmount: '',
      commissionFees: ''
    });

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
      setError('Please upload a CSV or Excel file');
    }
  }, []);

  // Sütun eşleştirme değişikliklerini izle
  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="w-full">
      {!isFileLoaded ? (
        <div 
          {...getRootProps()} 
          className={`p-6 border-2 border-dashed rounded-lg cursor-pointer text-center ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p className="text-blue-500">Drop your file here...</p>
          ) : (
            <div>
              <p className="mb-2">Drag and drop your trading history file here, or click to browse</p>
              <p className="text-sm text-gray-500">Supports CSV and Excel files</p>
              <p className="text-sm text-gray-500 mt-1">
                <a 
                  href="/sample-trades.csv" 
                  className="text-blue-500 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                  download
                >
                  Download sample CSV format
                </a>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-3xl mx-auto relative my-4 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => {
                setIsFileLoaded(false);
                setHeaders([]);
                setFileData([]);
                setError(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="mb-20 pb-4"> {/* Extra bottom padding to ensure space for fixed buttons */}
              <h3 className="text-xl font-bold mb-4">Map Your Columns</h3>
              
              <div className="mb-5">
                <p className="text-sm text-gray-600 mb-2">
                  We've automatically mapped your columns. Please verify or adjust if needed.
                </p>
                <p className="text-sm font-medium text-gray-800 mb-3">
                  Required fields: <span className="text-primary-600">Symbol, Transaction Type, Number of Shares, Price Per Share</span>
                </p>
                
                <div className="p-3 sm:p-4 bg-blue-50 border border-blue-100 rounded-md mb-5">
                  <p className="text-sm text-blue-700">
                    <strong>Tip:</strong> Select the column names from your file that match each field. The system will automatically standardize values.
                  </p>
                  <ul className="text-xs text-blue-700 mt-2 list-disc pl-4 space-y-1">
                    <li><strong>Transaction Type:</strong> Values like "Buy", "b", "Long", "Purchase" will be recognized as "Buy"</li>
                    <li><strong>Symbol:</strong> Stock ticker symbol (e.g., AAPL, MSFT, GOOGL)</li>
                    <li><strong>Date Format:</strong> Any standard date format is accepted (YYYY-MM-DD recommended)</li>
                  </ul>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock Symbol <span className="text-red-500">*</span></label>
                    <select 
                      value={columnMapping.ticker} 
                      onChange={(e) => handleMappingChange('ticker', e.target.value)}
                      className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">-- Select --</option>
                      {headers.map((header, index) => (
                        <option key={index} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type <span className="text-red-500">*</span></label>
                    <select 
                      value={columnMapping.transactionType} 
                      onChange={(e) => handleMappingChange('transactionType', e.target.value)}
                      className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">-- Select --</option>
                      {headers.map((header, index) => (
                        <option key={index} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Shares <span className="text-red-500">*</span></label>
                    <select 
                      value={columnMapping.numberOfShares} 
                      onChange={(e) => handleMappingChange('numberOfShares', e.target.value)}
                      className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">-- Select --</option>
                      {headers.map((header, index) => (
                        <option key={index} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price Per Share <span className="text-red-500">*</span></label>
                    <select 
                      value={columnMapping.pricePerShare} 
                      onChange={(e) => handleMappingChange('pricePerShare', e.target.value)}
                      className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">-- Select --</option>
                      {headers.map((header, index) => (
                        <option key={index} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date (Optional)</label>
                    <select 
                      value={columnMapping.transactionDate} 
                      onChange={(e) => handleMappingChange('transactionDate', e.target.value)}
                      className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">-- Select --</option>
                      {headers.map((header, index) => (
                        <option key={index} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (Optional)</label>
                    <select 
                      value={columnMapping.totalAmount} 
                      onChange={(e) => handleMappingChange('totalAmount', e.target.value)}
                      className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">-- Select --</option>
                      {headers.map((header, index) => (
                        <option key={index} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commission/Fees (Optional)</label>
                    <select 
                      value={columnMapping.commissionFees} 
                      onChange={(e) => handleMappingChange('commissionFees', e.target.value)}
                      className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">-- Select --</option>
                      {headers.map((header, index) => (
                        <option key={index} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6 font-medium">
                  {error}
                </div>
              )}
            </div>
            
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex justify-between">
              <button 
                onClick={() => {
                  setIsFileLoaded(false);
                  setHeaders([]);
                  setFileData([]);
                  setError(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button 
                onClick={processMappedData} 
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Process Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeHistoryUploader; 