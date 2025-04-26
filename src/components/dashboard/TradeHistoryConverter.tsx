'use client';

import { useState } from 'react';
import TradeHistoryUploader from './TradeHistoryUploader';

interface TradeData {
  ticker: string;
  transactionType: 'Buy' | 'Sell';
  numberOfShares: number;
  pricePerShare: number;
  transactionDate: string;
  totalAmount: number;
  commissionFees: number;
}

export default function TradeHistoryConverter() {
  const [tradeData, setTradeData] = useState<TradeData[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  const handleDataProcessed = (data: TradeData[]) => {
    setTradeData(data);
    setSelectedRows([]);
  };

  const handleRowSelect = (index: number) => {
    setSelectedRows(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedRows.length === tradeData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(tradeData.map((_, index) => index));
    }
  };

  const handleTransferToCalculator = () => {
    if (selectedRows.length === 0) {
      alert('Please select at least one trade to transfer');
      return;
    }
    
    // Implementation of functionality to transfer selected trades to tax calculator
    alert('Transfer to tax calculator functionality is under development');
  };

  // Explicitly cast TradeHistoryUploader to any to avoid TypeScript errors
  const UploaderComponent = TradeHistoryUploader as any;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <h2 className="text-xl font-bold mb-4">Trading History Converter</h2>
      
      {tradeData.length === 0 ? (
        <div>
          <p className="text-gray-600 mb-4">
            Upload your trading history in CSV or Excel format to convert it to the format needed for tax calculations.
          </p>
          <UploaderComponent onDataProcessed={handleDataProcessed} />
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> Your file should include columns for stock symbol, transaction type (buy/sell), 
              number of shares, and price per share. For best results, include transaction date, total amount, and commission/fees.
            </p>
            <p className="text-sm text-blue-700 mt-2">
              You can download a sample file format <a href="/sample-trades.csv" className="underline" download>here</a>.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Your Trading History</h3>
            <div className="flex space-x-2">
              <button 
                onClick={() => setTradeData([])}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Upload Another File
              </button>
              <button 
                onClick={handleTransferToCalculator}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={selectedRows.length === 0}
              >
                Transfer to Tax Calculator
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    <input 
                      type="checkbox" 
                      checked={selectedRows.length > 0 && selectedRows.length === tradeData.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction Type
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shares
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fees
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tradeData.map((trade, index) => (
                  <tr key={index} className={selectedRows.includes(index) ? 'bg-blue-50' : ''}>
                    <td className="px-3 py-2">
                      <input 
                        type="checkbox" 
                        checked={selectedRows.includes(index)}
                        onChange={() => handleRowSelect(index)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{trade.ticker}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        trade.transactionType === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {trade.transactionType}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{trade.numberOfShares}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{trade.pricePerShare.toFixed(2)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{trade.transactionDate}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{trade.totalAmount.toFixed(2)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{trade.commissionFees.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {tradeData.length > 0 && (
            <p className="mt-2 text-sm text-gray-500">
              {tradeData.length} trade(s) found. Select the trades you want to transfer to the tax calculator.
            </p>
          )}
        </div>
      )}
    </div>
  );
} 