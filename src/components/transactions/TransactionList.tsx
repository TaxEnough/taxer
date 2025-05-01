'use client';

import React, { useEffect, useState } from "react";
import {
  Table,
  TableCaption,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Edit, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

// Transaction type interface
export interface Transaction {
  id?: string;
  ticker: string;
  type: 'buy' | 'sell' | 'dividend';
  shares: number;
  price: number;
  amount: number;
  date: string;
  fee?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

const TransactionList = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  
  // Basit bir auth kontrolü
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    // localStorage'dan auth bilgisini kontrol et
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          // Kullanıcı giriş yapmış kabul edilir
          setUser({ uid: 'authenticated-user' });
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    } else {
      setLoading(false);
      setTransactions([]);
    }
  }, [user]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/transactions');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Sort by date (newest first)
      const sortedData = data.sort((a: Transaction, b: Transaction) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setTransactions(sortedData);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (transactionId: string) => {
    setTransactionToDelete(transactionId);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    
    setIsDeleting(true);
    try {
      // Include credentials for cookies to be sent
      const response = await fetch(`/api/transactions/${transactionToDelete}`, {
        method: 'DELETE',
        credentials: 'include', // Important: sends cookies with the request
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Authentication Error",
            description: "Please log in again to continue",
            variant: "destructive",
          });
          return;
        }
        
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete transaction");
      }
      
      // Successfully deleted
      setTransactions(
        transactions.filter((t) => t.id !== transactionToDelete)
      );
      
      toast({
        title: "Success",
        description: "Transaction deleted successfully",
      });
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete transaction",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setTransactionToDelete(null);
    }
  };

  const handleTransactionSaved = () => {
    fetchTransactions();
    setIsDialogOpen(false);
    setSelectedTransaction(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center my-8">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center my-8">
        <p className="mb-4">Please sign in to view your transactions.</p>
        <Link href="/signin">
          <Button>Sign In</Button>
        </Link>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center my-8">
        <p className="mb-4">No transactions found. Add your first transaction to get started.</p>
        <Button onClick={() => setIsDialogOpen(true)}>Add Transaction</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-bold">Your Transactions</h2>
        <Button onClick={() => setIsDialogOpen(true)}>Add Transaction</Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableCaption>
            Your transaction history
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Ticker</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{formatDate(transaction.date)}</TableCell>
                <TableCell className={
                  transaction.type === 'buy' 
                    ? 'text-green-600 font-medium' 
                    : transaction.type === 'sell' 
                      ? 'text-red-600 font-medium'
                      : 'text-blue-600 font-medium'
                }>
                  {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                </TableCell>
                <TableCell className="font-medium">{transaction.ticker}</TableCell>
                <TableCell className="text-right">{transaction.shares}</TableCell>
                <TableCell className="text-right">{formatCurrency(transaction.price)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(transaction.amount)}</TableCell>
                <TableCell className="text-right">{transaction.fee ? formatCurrency(transaction.fee) : '-'}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => handleEdit(transaction)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => handleDeleteClick(transaction.id!)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 
                <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                : 'Delete'
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Basit TransactionDialog uygulaması */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTransaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
          </DialogHeader>
          
          <p className="py-4">This is a simplified version for deployment. Please implement the full transaction form here.</p>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransactionSaved}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionList; 