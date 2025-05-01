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
import { Edit, Trash2, AlertTriangle } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/components/ui/use-toast';
import { getAuthTokenFromClient } from '@/lib/auth-client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  const openDeleteConfirm = (id: string) => {
    setDeleteId(id);
    setConfirmOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteId) return;
    
    try {
      const response = await fetch(`/api/transactions/${deleteId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        let errorDetails = 'Error deleting transaction';
        try {
          const errorData = await response.json();
          errorDetails = errorData.details || errorData.error || errorDetails;
          console.error('Transaction deletion error:', errorData);
        } catch (e) {
          console.error('Could not parse error response:', e);
        }
        
        throw new Error(errorDetails);
      }

      // Update UI after successful deletion
      setTransactions((prevTransactions) => 
        prevTransactions.filter((transaction) => transaction.id !== deleteId)
      );

      toast({
        title: "Success",
        description: "Transaction has been successfully deleted.",
      });
    } catch (error: any) {
      console.error('Transaction deletion error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete transaction",
        variant: 'destructive',
      });
    } finally {
      setConfirmOpen(false);
      setDeleteId(null);
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
                    onClick={() => openDeleteConfirm(transaction.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md bg-white border border-gray-200 shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-gray-900">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Transaction
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to delete this transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t border-gray-100 pt-4">
            <AlertDialogCancel className="border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              onClick={handleDeleteConfirmed}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 