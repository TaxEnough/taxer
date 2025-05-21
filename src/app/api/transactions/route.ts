import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { clerkClient } from '@clerk/nextjs/server';
import { 
  getUserTransactionsFromFirestore, 
  createTransactionInFirestore 
} from '@/lib/transaction-firebase';

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
    
    // Her durumda kullanıcılara premium erişim veriyoruz (geliştirme aşamasında)
    // Gerçek premium kontrolü için verifyPremiumAccess gibi bir fonksiyon çağrılabilir
    const userId = decodedToken.uid;
    
    try {
      // Clerk API'sini clerkClient ile alalım
      const clerk = await clerkClient();
      
      try {
        // Kullanıcı bilgilerini kontrol et
        const user = await clerk.users.getUser(userId);
        
        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        
        // Get user transactions from Firestore
        const transactions = await getUserTransactionsFromFirestore(userId);
        return NextResponse.json(transactions);
      } catch (clerkError) {
        console.error('Clerk API error:', clerkError);
        
        // Clerk API hatası olsa bile, token geçerliyse işlemleri getir
        // Bu kullanıcıya premium erişim vermeye benzer şekilde, kullanıcı deneyimini iyileştirmek için
        const transactions = await getUserTransactionsFromFirestore(userId);
        return NextResponse.json(transactions);
      }
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
    
    // Her durumda kullanıcılara premium erişim veriyoruz (geliştirme aşamasında)
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
      // Clerk API ile kullanıcıyı doğrula
      const clerk = await clerkClient();
      
      try {
        const user = await clerk.users.getUser(userId);
        
        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        
        // Save transaction to Firestore
        const newTransaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
          ticker: transactionData.ticker,
          type: transactionData.type,
          shares: transactionData.shares,
          price: transactionData.price,
          amount: transactionData.amount || (transactionData.shares * transactionData.price),
          date: transactionData.date,
          fee: transactionData.fee || 0,
          notes: transactionData.notes || '',
          userId
        };
        
        // Create transaction in Firestore
        const transactionId = await createTransactionInFirestore(userId, newTransaction);
        
        return NextResponse.json({
          id: transactionId,
          ...newTransaction,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { status: 201 });
      } catch (clerkError) {
        console.error('Clerk API error:', clerkError);
        
        // Clerk API hatası olsa bile işlemi kaydet
        const newTransaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
          ticker: transactionData.ticker,
          type: transactionData.type,
          shares: transactionData.shares,
          price: transactionData.price,
          amount: transactionData.amount || (transactionData.shares * transactionData.price),
          date: transactionData.date,
          fee: transactionData.fee || 0,
          notes: transactionData.notes || '',
          userId
        };
        
        // Create transaction in Firestore
        const transactionId = await createTransactionInFirestore(userId, newTransaction);
        
        return NextResponse.json({
          id: transactionId,
          ...newTransaction,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { status: 201 });
      }
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