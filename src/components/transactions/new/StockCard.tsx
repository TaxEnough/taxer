import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronDown, ChevronUp, Trash2, Pencil, DollarSign } from 'lucide-react';
import { Transaction } from '@/types/transaction';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';

interface StockCardProps {
  ticker: string;
  transactions: Transaction[];
  summary: {
    totalShares: number;
    totalCost: number;
    averageCost: number;
    remainingShares: number;
    currentValue: number;
    totalProfit: number;
  };
  onAddTransaction: (ticker: string) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onSellStock: (ticker: string, availableShares: number, avgCost: number) => void;
}

export default function StockCard({
  ticker,
  transactions,
  summary,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onSellStock
}: StockCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Sort transactions by date (newest first)
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  // Calculate if there's any profit/loss
  const hasProfit = summary.totalProfit > 0;
  const hasLoss = summary.totalProfit < 0;
  
  // Calculate remaining shares
  const hasRemainingShares = summary.remainingShares > 0;
  
  return (
    <Card className="w-full mb-4 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold">{ticker}</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <CardDescription>
            <span className="font-medium">Average Cost: </span> 
            {formatCurrency(summary.averageCost)}
          </CardDescription>
          
          {hasRemainingShares && (
            <Badge variant="outline">
              {formatNumber(summary.remainingShares)} shares
            </Badge>
          )}
          
          {hasProfit && (
            <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
              Profit: {formatCurrency(summary.totalProfit)}
            </Badge>
          )}
          
          {hasLoss && (
            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
              Loss: {formatCurrency(summary.totalProfit)}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-xs font-medium text-gray-500">Total Acquired</div>
                <div className="font-semibold">{formatNumber(summary.totalShares)} shares</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-xs font-medium text-gray-500">Total Investment</div>
                <div className="font-semibold">{formatCurrency(summary.totalCost)}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-xs font-medium text-gray-500">Current Position</div>
                <div className="font-semibold">{formatCurrency(summary.currentValue)}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-xs font-medium text-gray-500">Realized P/L</div>
                <div className={`font-semibold ${hasProfit ? 'text-green-600' : hasLoss ? 'text-red-600' : ''}`}>
                  {formatCurrency(summary.totalProfit)}
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="font-medium text-sm mb-2">Transaction History</div>
              <div className="space-y-2">
                {sortedTransactions.map(transaction => (
                  <div 
                    key={transaction.id} 
                    className={`flex justify-between items-center p-3 rounded-lg ${
                      transaction.type === 'buy' 
                        ? 'bg-green-50 border border-green-100' 
                        : transaction.type === 'sell'
                          ? 'bg-red-50 border border-red-100'
                          : 'bg-blue-50 border border-blue-100'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="font-medium">
                        {transaction.type === 'buy' ? 'Buy' : transaction.type === 'sell' ? 'Sell' : 'Dividend'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(transaction.date)} • {formatNumber(transaction.shares)} shares @ {formatCurrency(transaction.price)}
                      </div>
                      {transaction.fee !== undefined && transaction.fee > 0 && (
                        <div className="text-xs text-gray-500">
                          Fee: {formatCurrency(transaction.fee)}
                        </div>
                      )}
                      {transaction.notes && (
                        <div className="text-xs text-gray-600 mt-1">
                          {transaction.notes}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => onEditTransaction(transaction)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-red-500"
                        onClick={() => onDeleteTransaction(transaction.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      )}
      
      <CardFooter className="flex justify-between pt-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onAddTransaction(ticker)}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Transaction
        </Button>
        
        {hasRemainingShares && (
          <Button 
            variant="outline" 
            size="sm"
            className="border-red-200 text-red-600"
            onClick={() => onSellStock(ticker, summary.remainingShares, summary.averageCost)}
          >
            <DollarSign className="h-4 w-4 mr-1" /> Sell
          </Button>
        )}
      </CardFooter>
    </Card>
  );
} 