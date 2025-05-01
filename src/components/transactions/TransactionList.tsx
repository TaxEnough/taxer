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
import { auth } from '@/lib/firebase';

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
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      // Simple fetch with cookies - let the browser handle auth
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Important: include cookies
      });
      
      // Handle response
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to delete transaction' }));
        throw new Error(error.error || `Failed to delete (status ${response.status})`);
      }
      
      // Update UI directly
      setTransactions(transactions.filter(t => t.id !== id));
      
      // Show success message
      toast({
        title: "Success",
        description: "Transaction successfully deleted",
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete transaction",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
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