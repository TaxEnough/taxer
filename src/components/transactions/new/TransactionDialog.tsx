import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Transaction, transactionTypeOptions } from '@/types/transaction';
import { toast } from 'react-hot-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

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

interface TransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Transaction, 'id'>) => Promise<void>;
  defaultValues?: Transaction;
  mode: 'add' | 'edit' | 'sell';
  ticker?: string;
  availableShares?: number;
  averageCost?: number;
}

export default function TransactionDialog({
  isOpen,
  onClose,
  onSubmit,
  defaultValues,
  mode,
  ticker = '',
  availableShares = 0,
  averageCost = 0
}: TransactionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form setup with validation
  const form = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: defaultValues 
      ? {
          ...defaultValues,
          date: defaultValues.date ? new Date(defaultValues.date) : new Date(),
          amount: defaultValues.amount || 0,
          fee: defaultValues.fee || 0,
          notes: defaultValues.notes || '',
        }
      : {
          ticker: ticker,
          type: mode === 'sell' ? 'sell' : 'buy',
          shares: mode === 'sell' ? availableShares : 0,
          price: mode === 'sell' ? averageCost : 0,
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
    const calculatedAmount = shares * price;
    form.setValue('amount', calculatedAmount);
    return calculatedAmount;
  };
  
  // Update amount when shares or price change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'shares' || name === 'price') {
        calculateAmount();
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form.watch]);
  
  // Get title and action text based on mode
  const getTitle = () => {
    switch (mode) {
      case 'add':
        return 'Add Transaction';
      case 'edit':
        return 'Edit Transaction';
      case 'sell':
        return 'Sell Stock';
    }
  };
  
  const getActionText = () => {
    switch (mode) {
      case 'add':
        return 'Add';
      case 'edit':
        return 'Save Changes';
      case 'sell':
        return 'Sell';
    }
  };
  
  // Handle form submission
  const handleSubmit = async (data: TransactionFormInput) => {
    try {
      setIsSubmitting(true);
      
      // Format date to string
      const formattedData = {
        ...data,
        date: format(data.date, 'yyyy-MM-dd'),
        amount: data.amount || calculateAmount(),
      };
      
      await onSubmit(formattedData as Omit<Transaction, 'id'>);
      setIsSubmitting(false);
      onClose();
      
      toast.success(`Transaction ${mode === 'add' ? 'added' : mode === 'edit' ? 'updated' : 'recorded'} successfully`);
    } catch (error: any) {
      setIsSubmitting(false);
      toast.error(error.message || 'Failed to process transaction');
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            {mode === 'add' && 'Add a new transaction to your investment history.'}
            {mode === 'edit' && 'Modify the details of your existing transaction.'}
            {mode === 'sell' && `Sell shares of ${ticker} at market price or specified price.`}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Ticker Field */}
            <FormField
              control={form.control}
              name="ticker"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock Symbol</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="e.g. AAPL" 
                      disabled={mode === 'edit' || mode === 'sell'} 
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
                  <FormLabel>Transaction Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value} 
                    disabled={mode === 'sell'}
                  >
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
            
            <div className="grid grid-cols-2 gap-4">
              {/* Shares Field */}
              <FormField
                control={form.control}
                name="shares"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Shares</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.0001"
                        min={0.0001}
                        max={mode === 'sell' ? availableShares : undefined}
                        value={field.value}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          field.onChange(isNaN(val) ? 0 : val);
                        }}
                      />
                    </FormControl>
                    {mode === 'sell' && (
                      <FormDescription>
                        Available: {availableShares.toFixed(4)}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Price Field */}
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per Share</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        min={0}
                        value={field.value}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          field.onChange(isNaN(val) ? 0 : val);
                        }}
                      />
                    </FormControl>
                    {mode === 'sell' && averageCost > 0 && (
                      <FormDescription>
                        Avg. cost: ${averageCost.toFixed(2)}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Date Field */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Transaction Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
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
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Fee Field */}
              <FormField
                control={form.control}
                name="fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission/Fees</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        min={0}
                        value={field.value === undefined ? 0 : field.value}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          field.onChange(isNaN(val) ? 0 : val);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Notes Field */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field}
                      placeholder="Add any additional notes about this transaction"
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Total Amount Preview */}
            <div className="bg-muted p-3 rounded-md">
              <div className="font-semibold text-sm mb-1">Transaction Summary</div>
              <div className="text-sm flex justify-between">
                <span>Total Amount:</span>
                <span className="font-medium">
                  ${(form.watch('shares') * form.watch('price')).toFixed(2)}
                </span>
              </div>
              {form.watch('fee') > 0 && (
                <div className="text-sm flex justify-between">
                  <span>Fees:</span>
                  <span className="font-medium">${form.watch('fee').toFixed(2)}</span>
                </div>
              )}
              {mode === 'sell' && (
                <div className="text-sm flex justify-between mt-1 border-t pt-1">
                  <span>Estimated P/L:</span>
                  <span className={`font-medium ${
                    form.watch('price') > averageCost ? 'text-green-600' : 
                    form.watch('price') < averageCost ? 'text-red-600' : ''
                  }`}>
                    ${((form.watch('price') - averageCost) * form.watch('shares')).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                variant={mode === 'sell' ? 'destructive' : 'default'}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : getActionText()}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 