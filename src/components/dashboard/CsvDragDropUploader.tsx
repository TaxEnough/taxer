import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface MappedField {
  sourceName: string;
  targetName: string;
  required: boolean;
  mapped: boolean;
}

interface CsvData {
  headers: string[];
  preview: any[];
  data: any[];
}

interface UploadedFile {
  name: string;
  type: string;
  size: number;
}

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

interface CsvDragDropUploaderProps {
  onDataProcessed: (stocks: Stock[]) => void;
}

export default function CsvDragDropUploader({ onDataProcessed }: CsvDragDropUploaderProps) {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isFieldMappingOpen, setIsFieldMappingOpen] = useState(false);
  
  // Required fields that we need in our application
  const requiredFields = [
    { targetName: 'Symbol', required: true, mapped: false, sourceName: '' },
    { targetName: 'Buy Price', required: true, mapped: false, sourceName: '' },
    { targetName: 'Sell Price', required: true, mapped: false, sourceName: '' },
    { targetName: 'Shares Sold', required: true, mapped: false, sourceName: '' },
    { targetName: 'Fee/Commissions', required: false, mapped: false, sourceName: '' },
    { targetName: 'Buy Date', required: true, mapped: false, sourceName: '' },
    { targetName: 'Sell Date', required: true, mapped: false, sourceName: '' },
  ];
  
  const [fieldMapping, setFieldMapping] = useState<MappedField[]>(requiredFields);
  const [savedMappings, setSavedMappings] = useState<{[key: string]: MappedField[]}>({});

  // Parse delimited text (CSV)
  const parseCSV = (fileContent: string) => {
    return new Promise((resolve, reject) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            // Ensure results.data[0] is an object before trying to get keys
            const firstRow = results.data[0] as Record<string, unknown>;
            const headers = Object.keys(firstRow);
            resolve({
              headers,
              data: results.data,
              preview: results.data.slice(0, 5)
            });
          } else {
            reject(new Error('No data found in file'));
          }
        },
        error: (error: Error) => {
          reject(error);
        }
      });
    });
  };

  // Parse Excel files
  const parseExcel = (arrayBuffer: ArrayBuffer) => {
    try {
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        throw new Error('No data found in file');
      }
      
      // Ensure jsonData[0] is an object before trying to get keys
      const firstRow = jsonData[0] as Record<string, unknown>;
      const headers = Object.keys(firstRow);
      
      return {
        headers,
        data: jsonData,
        preview: jsonData.slice(0, 5)
      };
    } catch (error) {
      throw error;
    }
  };

  // Automatically try to map fields based on common naming patterns
  const autoMapFields = (headers: string[]) => {
    const commonMappings: {[key: string]: string[]} = {
      'Symbol': ['symbol', 'ticker', 'stock', 'security', 'stocksymbol'],
      'Buy Price': ['buyprice', 'buy price', 'purchaseprice', 'purchase price', 'boughtprice', 'bought price', 'cost', 'costprice'],
      'Sell Price': ['sellprice', 'sell price', 'saleprice', 'sale price', 'soldprice', 'sold price', 'sellingprice'],
      'Shares Sold': ['sharessold', 'shares sold', 'quantity', 'qty', 'amount', 'numshares', 'shares', 'sharesamount'],
      'Fee/Commissions': ['fee', 'commission', 'fees', 'commissions', 'tradingfee', 'tradingfees', 'cost', 'expense'],
      'Buy Date': ['buydate', 'buy date', 'purchasedate', 'purchase date', 'datebought', 'date bought', 'acquisition date'],
      'Sell Date': ['selldate', 'sell date', 'saledate', 'sale date', 'datesold', 'date sold', 'disposal date']
    };

    const newMapping = [...fieldMapping];
    
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      Object.entries(commonMappings).forEach(([targetField, possibleMatches]) => {
        const matchingField = newMapping.find(f => f.targetName === targetField);
        if (matchingField && !matchingField.mapped) {
          if (possibleMatches.includes(lowerHeader) || 
              possibleMatches.some(match => lowerHeader.includes(match))) {
            matchingField.sourceName = header;
            matchingField.mapped = true;
          }
        }
      });
    });
    
    return newMapping;
  };

  // Read the file and prepare data
  const processFile = async (file: File) => {
    setUploadStatus('uploading');
    setUploadError(null);
    
    try {
      const fileInfo = {
        name: file.name,
        type: file.type,
        size: file.size
      };
      setUploadedFile(fileInfo);
      
      // Handle based on file type
      let parsedData;
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'csv') {
        const text = await file.text();
        parsedData = await parseCSV(text);
      } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
        const buffer = await file.arrayBuffer();
        parsedData = parseExcel(buffer);
      } else {
        throw new Error('Unsupported file format. Please upload a CSV or Excel file.');
      }
      
      // Set the CSV data
      setCsvData(parsedData as CsvData);
      
      // Auto-map fields
      const mappedFields = autoMapFields((parsedData as CsvData).headers);
      setFieldMapping(mappedFields);
      
      // Check if we've previously saved this mapping format
      const headerKey = (parsedData as CsvData).headers.sort().join(',');
      const existingMapping = savedMappings[headerKey];
      if (existingMapping) {
        setFieldMapping(existingMapping);
      }
      
      setUploadStatus('success');
      setIsFieldMappingOpen(true);
    } catch (error) {
      console.error('Error processing file:', error);
      setUploadStatus('error');
      setUploadError((error as Error).message || 'Failed to process file');
    }
  };

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processFile(acceptedFiles[0]);
    }
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  });

  // Handle field mapping changes
  const handleFieldMappingChange = (targetField: string, sourceName: string) => {
    setFieldMapping(prev => 
      prev.map(field => 
        field.targetName === targetField 
          ? { ...field, sourceName, mapped: !!sourceName } 
          : field
      )
    );
  };

  // Calculate holding period in months
  const calculateHoldingPeriod = (buyDateStr: string, sellDateStr: string): number => {
    try {
      // Normalize and parse dates
      let buyDate: Date;
      let sellDate: Date;
      
      // Try various common date formats
      if (buyDateStr.includes('-')) {
        // ISO format (YYYY-MM-DD)
        buyDate = new Date(buyDateStr);
      } else if (buyDateStr.includes('/')) {
        // Try MM/DD/YYYY or DD/MM/YYYY
        const parts = buyDateStr.split('/').map(p => parseInt(p));
        if (parts[2] < 100) parts[2] += 2000; // Handle 2-digit years
        
        // Assume MM/DD/YYYY for US format
        buyDate = new Date(parts[2], parts[0] - 1, parts[1]);
        
        // If date is invalid, try DD/MM/YYYY
        if (isNaN(buyDate.getTime())) {
          buyDate = new Date(parts[2], parts[1] - 1, parts[0]);
        }
      } else {
        // Try to parse as is
        buyDate = new Date(buyDateStr);
      }
      
      // Same logic for sell date
      if (sellDateStr.includes('-')) {
        sellDate = new Date(sellDateStr);
      } else if (sellDateStr.includes('/')) {
        const parts = sellDateStr.split('/').map(p => parseInt(p));
        if (parts[2] < 100) parts[2] += 2000;
        sellDate = new Date(parts[2], parts[0] - 1, parts[1]);
        if (isNaN(sellDate.getTime())) {
          sellDate = new Date(parts[2], parts[1] - 1, parts[0]);
        }
      } else {
        sellDate = new Date(sellDateStr);
      }
      
      // Check if dates are valid
      if (isNaN(buyDate.getTime()) || isNaN(sellDate.getTime())) {
        console.error("Invalid date format:", buyDateStr, sellDateStr);
        return 0;
      }
      
      // Calculate months between dates
      return (sellDate.getFullYear() - buyDate.getFullYear()) * 12 + 
             (sellDate.getMonth() - buyDate.getMonth());
    } catch (error) {
      console.error("Date calculation error:", error);
      return 0;
    }
  };

  // Process the data and transfer to calculator
  const processDataToStocks = () => {
    if (!csvData) return;
    
    // Check required fields
    const missingRequiredFields = fieldMapping
      .filter(field => field.required && !field.mapped)
      .map(field => field.targetName);
    
    if (missingRequiredFields.length > 0) {
      setUploadError(`Required fields not mapped: ${missingRequiredFields.join(', ')}`);
      return;
    }
    
    try {
      // Create field mapping dictionary
      const mapping: {[key: string]: string} = {};
      fieldMapping.forEach(field => {
        if (field.mapped && field.sourceName) {
          mapping[field.targetName] = field.sourceName;
        }
      });
      
      // Create stock objects from the data
      const stocks: Stock[] = csvData.data.map((row: Record<string, unknown>, index) => {
        // Get values using the mapping
        const symbol = String(row[mapping['Symbol']] || '');
        const buyPrice = parseFloat(String(row[mapping['Buy Price']] || '0'));
        const sellPrice = parseFloat(String(row[mapping['Sell Price']] || '0'));
        const sharesSold = parseFloat(String(row[mapping['Shares Sold']] || '0'));
        const tradingFees = parseFloat(String(row[mapping['Fee/Commissions']] || '0'));
        const buyDate = String(row[mapping['Buy Date']] || '');
        const sellDate = String(row[mapping['Sell Date']] || '');
        
        // Calculate holding period
        const holdingPeriod = calculateHoldingPeriod(buyDate, sellDate);
        
        return {
          id: `${symbol}-${index}-${Date.now()}`,
          symbol,
          purchasePrice: buyPrice,
          sellingPrice: sellPrice,
          sharesSold,
          tradingFees,
          holdingPeriod,
          gainLoss: (sellPrice - buyPrice) * sharesSold - tradingFees,
          isShortTerm: holdingPeriod <= 12
        };
      }).filter(stock => 
        // Filter out stocks with missing essential data
        stock.symbol && stock.purchasePrice && stock.sellingPrice && stock.sharesSold
      );
      
      // Save the mapping for future use with this format
      if (csvData.headers.length > 0) {
        const headerKey = csvData.headers.sort().join(',');
        setSavedMappings({
          ...savedMappings,
          [headerKey]: fieldMapping
        });
      }
      
      // Transfer the processed stocks
      onDataProcessed(stocks);
      
      // Reset the field mapping UI
      setIsFieldMappingOpen(false);
    } catch (error) {
      console.error('Error processing data:', error);
      setUploadError((error as Error).message || 'Failed to process data');
    }
  };

  // Generate sample CSV for download
  const handleDownloadSample = () => {
    const sampleCSVContent = `Symbol,Buy Price,Sell Price,Shares Sold,Fee/Commissions,Buy Date,Sell Date
AAPL,150.25,180.75,10,7.99,2023-01-15,2023-06-20
MSFT,270.50,320.45,8,7.99,2023-02-10,2023-08-15
GOOGL,2450.75,2750.50,2,7.99,2023-03-10,2023-07-10
TSLA,200.50,235.75,15,7.99,2023-03-01,2023-07-15`;

    const blob = new Blob([sampleCSVContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-stock-trades.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Import Trading Data</h2>
      
      <div className="mb-4">
        <button
          onClick={handleDownloadSample}
          className="text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 mr-1" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
            />
          </svg>
          Download Sample CSV Template
        </button>
      </div>
      
      {/* Drag and Drop Zone */}
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-6 ${
          isDragActive 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-gray-400'
        } transition-colors cursor-pointer`}
      >
        <input {...getInputProps()} />
        
        <div className="text-center">
          <svg 
            className={`mx-auto h-12 w-12 ${
              isDragActive ? 'text-primary-500' : 'text-gray-400'
            }`} 
            stroke="currentColor" 
            fill="none" 
            viewBox="0 0 48 48" 
            aria-hidden="true"
          >
            <path 
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <path 
              d="M16 8v-4a4 4 0 014-4h12a4 4 0 014 4v4m-6 0h6m-6 0H16m-6 12l6-6m0 0l6 6m-6-6v18" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </svg>
          
          <p className="mt-2 text-sm text-gray-700">
            {isDragActive 
              ? 'Drop the file here...' 
              : 'Drag and drop your CSV or Excel file here, or click to browse'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Supported formats: CSV, XLS, XLSX
          </p>
        </div>
      </div>
      
      {uploadStatus === 'uploading' && (
        <div className="mt-4 flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500"></div>
          <span className="ml-2 text-sm text-gray-600">Processing file...</span>
        </div>
      )}
      
      {uploadError && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{uploadError}</span>
          </div>
        </div>
      )}
      
      {/* Field Mapping Section */}
      {isFieldMappingOpen && csvData && (
        <div className="mt-6 border border-gray-200 rounded-lg p-4">
          <h3 className="text-md font-medium text-gray-900 mb-3">Map your CSV columns</h3>
          
          {/* File info */}
          {uploadedFile && (
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <div className="flex items-center text-sm text-gray-600">
                <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">{uploadedFile.name}</span>
                <span className="mx-2">•</span>
                <span>{csvData.data.length} records</span>
              </div>
            </div>
          )}
          
          {/* Data Preview */}
          <div className="mb-4 overflow-x-auto">
            <p className="text-sm font-medium text-gray-700 mb-2">Data Preview (First 5 rows)</p>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {csvData.headers.map((header, index) => (
                    <th 
                      key={index}
                      scope="col" 
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {csvData.preview.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {csvData.headers.map((header, colIndex) => (
                      <td key={colIndex} className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                        {row[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Field Mappings */}
          <div className="space-y-3 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Field Mapping</p>
            {fieldMapping.map((field, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-1/3">
                  <label className={`block text-xs font-medium ${field.required ? 'text-gray-700' : 'text-gray-500'}`}>
                    {field.targetName}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                </div>
                <div className="w-2/3">
                  <select
                    value={field.sourceName}
                    onChange={(e) => handleFieldMappingChange(field.targetName, e.target.value)}
                    className="block w-full pl-3 pr-10 py-1.5 text-xs border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 rounded-md"
                  >
                    <option value="">-- Select a column --</option>
                    {csvData.headers.map((header, index) => (
                      <option key={index} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsFieldMappingOpen(false)}
              className="px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={processDataToStocks}
              className="px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-primary-600 hover:bg-primary-700"
            >
              Process Data
            </button>
          </div>
        </div>
      )}
      
      {/* Success Message */}
      {uploadStatus === 'success' && !isFieldMappingOpen && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md">
          <div className="flex">
            <svg className="h-5 w-5 text-green-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>File processed and data transferred successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
} 