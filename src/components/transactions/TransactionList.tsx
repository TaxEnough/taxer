'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/components/ui/use-toast';
import { getAuthTokenFromClient, removeAuthTokenFromClient } from '@/lib/auth-client';

// Transaction data type from API
type ApiTransaction = {
  id: string;
  stock: string;
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  quantity: number;
  profit: number;
  type: string;
  tradingFees: number;
  note: string;
  createdAt: any;
  updatedAt: any;
};

// Transaction type used in component
type Transaction = {
  id: string;
  ticker: string;
  date: string;
  transactionType: string;
  shares: number;
  price: number;
  fees: number;
  notes?: string;
  profit?: number;
};

export default function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = getAuthTokenFromClient();
      
      const response = await fetch('/api/transactions', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load transactions');
      }
      
      // Get API response
      const apiData: ApiTransaction[] = await response.json();
      
      // Transform API data to component format
      const formattedTransactions: Transaction[] = apiData.map(item => ({
        id: item.id,
        ticker: item.stock || '',
        date: item.sellDate || item.buyDate || '',
        transactionType: 'BUY', // Buy type as default
        shares: item.quantity || 0,
        price: item.sellPrice || item.buyPrice || 0,
        fees: item.tradingFees || 0,
        notes: item.note || '',
        profit: item.profit || 0
      }));
      
      setTransactions(formattedTransactions);
    } catch (error) {
      console.error('Transaction loading error:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while loading transactions.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      const token = getAuthTokenFromClient();
      
      if (!token) {
        toast({
          title: 'Authentication Error',
          description: 'You are not authenticated. Please log in again.',
          variant: 'destructive',
        });
        // Kullanıcıyı login sayfasına yönlendir
        window.location.href = '/login';
        return;
      }
      
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Parse error response to get more details
        let errorDetails = 'Failed to delete transaction';
        try {
          const errorData = await response.json();
          errorDetails = errorData.details || errorData.error || errorDetails;
          console.error('Transaction deletion error:', errorData);
          
          // Token ile ilgili bir hata varsa özel olarak işle
          if (
            response.status === 401 || 
            (errorData.code && (
              errorData.code === 'auth/id-token-expired' ||
              errorData.code === 'auth/argument-error' ||
              errorData.code.includes('auth/')
            ))
          ) {
            toast({
              title: 'Authentication Error',
              description: 'Your session has expired. Please log in again.',
              variant: 'destructive',
            });
            
            // Token'ı client-side'dan temizle
            removeAuthTokenFromClient();
            
            // Kullanıcıyı login sayfasına yönlendir
            setTimeout(() => {
              window.location.href = '/login';
            }, 1000);
            
            return;
          }
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        
        if (response.status === 401) {
          toast({
            title: 'Authentication Error',
            description: 'Your session has expired. Please log in again.',
            variant: 'destructive',
          });
          // Kullanıcıyı login sayfasına yönlendir
          setTimeout(() => {
            window.location.href = '/login';
          }, 1000);
          return;
        }
        
        throw new Error(errorDetails);
      }

      setTransactions((prevTransactions) => 
        prevTransactions.filter((transaction) => transaction.id !== id)
      );

      toast({
        title: 'Success',
        description: 'Transaction successfully deleted.',
      });
    } catch (error: any) {
      console.error('Transaction deletion error:', error);
      toast({
        title: 'Error',
        description: error.message || 'An error occurred while deleting the transaction.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return <div className="text-center py-8">No transactions found.</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableCaption>Transaction list</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Symbol</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Fees</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>{formatDate(transaction.date ? new Date(transaction.date) : null)}</TableCell>
              <TableCell className="font-medium">{transaction.ticker}</TableCell>
              <TableCell>
                <span className="px-2 py-1 text-xs font-medium rounded-md bg-green-50 text-green-600">
                  Buy
                </span>
              </TableCell>
              <TableCell className="text-right">{transaction.shares}</TableCell>
              <TableCell className="text-right">{formatCurrency(transaction.price)}</TableCell>
              <TableCell className="text-right">{formatCurrency(transaction.price * transaction.shares)}</TableCell>
              <TableCell className="text-right">{formatCurrency(transaction.fees)}</TableCell>
              <TableCell>
                <div className="flex justify-center space-x-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/transactions/edit/${transaction.id}`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleDelete(transaction.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 