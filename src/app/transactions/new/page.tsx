'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { ArrowLeft, Calendar as CalendarIcon } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Transaction, transactionTypeOptions } from '@/types/transaction';
import { getAuthTokenFromClient } from '@/lib/auth-client';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

// Form validation schema
const transactionSchema = z.object({
  ticker: z.string().min(1, "Stock symbol is required"),
  type: z.enum(["buy", "sell", "dividend"], {
    required_error: "Please select a transaction type",
  }),
  shares: z.number()
    .positive("Number of shares must be positive")
    .min(0.0001, "Shares must be at least 0.0001"),
  price: z.number()
    .min(0, "Price cannot be negative"),
  amount: z.number()
    .min(0, "Amount cannot be negative")
    .optional(),
  date: z.date({
    required_error: "Transaction date is required",
  }),
  fee: z.number()
    .min(0, "Fee cannot be negative")
    .optional(),
  notes: z.string().optional(),
});

// Form input type
type TransactionFormInput = z.infer<typeof transactionSchema>;

export default function NewTransactionsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  
  // Form setup with validation
  const form = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      ticker: '',
      type: 'buy',
      shares: 0,
      price: 0,
      amount: 0,
      date: new Date(),
      fee: 0,
      notes: '',
    }
  });
  
  // Calculate total amount
  const calculateAmount = () => {
    const shares = form.getValues('shares') || 0;
    const price = form.getValues('price') || 0;
    const fee = form.getValues('fee') || 0;
    
    let calculatedAmount = shares * price;
    if (form.getValues('type') === 'buy') {
      calculatedAmount += fee;
    } else if (form.getValues('type') === 'sell') {
      calculatedAmount -= fee;
    }
    
    form.setValue('amount', calculatedAmount);
    setTotalAmount(calculatedAmount);
    return calculatedAmount;
  };
  
  // Update amount when shares or price change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'shares' || name === 'price' || name === 'fee' || name === 'type') {
        calculateAmount();
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form.watch]);
  
  // Handle form submission
  const handleSubmit = async (data: TransactionFormInput) => {
    try {
      setIsSubmitting(true);
      
      const token = await getAuthTokenFromClient();
      
      if (!token) {
        throw new Error('Authentication token not available');
      }
      
      // Format date to string
      const formattedData = {
        ...data,
        date: format(data.date, 'yyyy-MM-dd'),
        amount: data.amount || calculateAmount(),
      };
      
      // Create new transaction
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formattedData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create transaction');
      }
      
      // Successfully added transaction
      toast.success('Transaction added successfully');
      router.push('/transactions');
    } catch (error: any) {
      console.error('Transaction submission error:', error);
      toast.error(error.message || 'Failed to process transaction');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <Link href="/transactions" className="inline-flex items-center text-gray-600 hover:text-gray-900 mr-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Transactions
            </Link>
            <h1 className="text-3xl font-bold">Add New Transaction</h1>
          </div>
          <p className="text-gray-500">
            Record a new investment transaction to your portfolio
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stock Symbol */}
                <FormField
                  control={form.control}
                  name="ticker"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Stock Symbol</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g. AAPL" 
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Transaction Type */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Transaction Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select transaction type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {transactionTypeOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Number of Shares */}
                <FormField
                  control={form.control}
                  name="shares"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Number of Shares</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            field.onChange(isNaN(value) ? 0 : value);
                          }}
                          value={field.value}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Price Per Share */}
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Price Per Share</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            field.onChange(isNaN(value) ? 0 : value);
                          }}
                          value={field.value}
                          className="w-full"
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Transaction Date */}
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-medium">Transaction Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Select date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Commission/Fees */}
                <FormField
                  control={form.control}
                  name="fee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">Commission/Fees</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            field.onChange(isNaN(value) ? 0 : value);
                          }}
                          value={field.value}
                          className="w-full"
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add any additional notes about this transaction"
                        className="min-h-[80px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Transaction Summary */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-lg font-medium mb-2">Transaction Summary</h3>
                <div className="flex justify-between items-center">
                  <span>Total Amount:</span>
                  <span className="font-bold text-lg">
                    ${totalAmount.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {form.getValues('type') === 'buy' 
                    ? "Total cost including commission/fees"
                    : form.getValues('type') === 'sell'
                      ? "Net proceeds after commission/fees"
                      : "Dividend amount"}
                </p>
              </div>
              
              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/transactions')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  {isSubmitting ? 'Adding...' : 'Add Transaction'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
} 