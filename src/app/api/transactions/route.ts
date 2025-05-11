import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { clerkClient } from '@clerk/nextjs/server';

// Transaction interface
interface Transaction {
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
  userId?: string;
}

// Validate transaction data
function validateTransaction(data: any): { valid: boolean; error?: string } {
  if (!data) return { valid: false, error: 'No transaction data provided' };
  
  if (!data.ticker) {
    return { valid: false, error: 'Ticker is required' };
  }
  
  if (!data.type || !['buy', 'sell', 'dividend'].includes(data.type)) {
    return { valid: false, error: 'Valid transaction type (buy/sell/dividend) is required' };
  }
  
  if (typeof data.shares !== 'number' || data.shares <= 0) {
    return { valid: false, error: 'Shares must be a positive number' };
  }
  
  if (typeof data.price !== 'number' || data.price < 0) {
    return { valid: false, error: 'Price must be a non-negative number' };
  }
  
  if (!data.date) {
    return { valid: false, error: 'Date is required' };
  }
  
  if (data.fee !== undefined && (typeof data.fee !== 'number' || data.fee < 0)) {
    return { valid: false, error: 'Fee must be a non-negative number' };
  }
  
  return { valid: true };
}

// GET transactions endpoint
export async function GET(request: NextRequest) {
  try {
    // Get and validate token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyAuthToken(token);
    
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Check for premium account status from token and cookies
    const premiumCookie = request.cookies.get('user-premium-status')?.value;
    let accountStatus = decodedToken.accountStatus || 'free';
    
    // Try to get premium status from cookie if not in token
    if ((accountStatus === 'free' || !accountStatus) && premiumCookie) {
      try {
        const premiumData = JSON.parse(premiumCookie);
        if (premiumData.accountStatus && 
            (premiumData.accountStatus === 'basic' || 
             premiumData.accountStatus === 'premium')) {
          accountStatus = premiumData.accountStatus;
        }
      } catch (e) {
        console.error('Failed to parse premium cookie:', e);
      }
    }
    
    // Check subscription status
    if (!accountStatus || accountStatus === 'free') {
      return NextResponse.json(
        { error: 'Premium subscription required for this operation' },
        { status: 403 }
      );
    }
    
    const userId = decodedToken.uid;
    
    try {
      // Verify user with Clerk
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Return sample data for demonstration
      // In a real app, this would fetch from your database
      const sampleTransactions: Transaction[] = [
        {
          id: '1',
          ticker: 'AAPL',
          type: 'buy',
          shares: 10,
          price: 150.50,
          amount: 1505.00,
          date: '2023-01-15',
          fee: 4.99,
          notes: 'Long-term investment',
          userId: userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          ticker: 'MSFT',
          type: 'buy',
          shares: 5,
          price: 210.75,
          amount: 1053.75,
          date: '2023-02-20',
          fee: 4.99,
          notes: 'Tech portfolio addition',
          userId: userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      return NextResponse.json(sampleTransactions);
    } catch (apiError) {
      console.error('API error:', apiError);
      return NextResponse.json(
        { error: 'An error occurred while retrieving transactions' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error getting transactions:', error);
    return NextResponse.json(
      { error: 'An error occurred while retrieving transactions' },
      { status: 500 }
    );
  }
}

// POST a new transaction endpoint
export async function POST(request: NextRequest) {
  try {
    // Get and validate token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyAuthToken(token);
    
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Check for premium account status from token and cookies
    const premiumCookie = request.cookies.get('user-premium-status')?.value;
    let accountStatus = decodedToken.accountStatus || 'free';
    
    // Try to get premium status from cookie if not in token
    if ((accountStatus === 'free' || !accountStatus) && premiumCookie) {
      try {
        const premiumData = JSON.parse(premiumCookie);
        if (premiumData.accountStatus && 
            (premiumData.accountStatus === 'basic' || 
             premiumData.accountStatus === 'premium')) {
          accountStatus = premiumData.accountStatus;
        }
      } catch (e) {
        console.error('Failed to parse premium cookie:', e);
      }
    }
    
    // Check subscription status
    if (!accountStatus || accountStatus === 'free') {
      return NextResponse.json(
        { error: 'Premium subscription required for this operation' },
        { status: 403 }
      );
    }
    
    const userId = decodedToken.uid;
    
    // Validate request body
    const transactionData = await request.json();
    const validation = validateTransaction(transactionData);
    
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Invalid transaction data',
        details: validation.error
      }, { status: 400 });
    }
    
    try {
      // Verify user with Clerk
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Dummy transaction creation response
      // In a real app, save to your database here
      return NextResponse.json({
        message: 'Transaction successfully created',
        id: 'new-transaction-id',
        ...transactionData,
        userId: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { status: 201 });
    } catch (apiError) {
      console.error('API error:', apiError);
      return NextResponse.json(
        { error: 'An error occurred while creating the transaction' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating the transaction' },
      { status: 500 }
    );
  }
} 