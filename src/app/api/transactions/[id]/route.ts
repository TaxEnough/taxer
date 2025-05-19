import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { clerkClient } from '@clerk/nextjs/server';
import { 
  getTransactionFromFirestore, 
  updateTransactionInFirestore, 
  deleteTransactionFromFirestore 
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

// Transaction validation for add/update
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

// Get transaction details endpoint
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    // Check for premium account status - client taraflı premium cookie'yi de kontrol et
    const premiumCookie = request.cookies.get('user-premium-status')?.value;
    let accountStatus = decodedToken.accountStatus || 'free';
    
    // Cookie'den premium durumunu almaya çalış eğer token'da yoksa
    if ((accountStatus === 'free' || !accountStatus) && premiumCookie) {
      try {
        const premiumData = JSON.parse(premiumCookie);
        if (premiumData.accountStatus && 
            (premiumData.accountStatus === 'basic' || 
            premiumData.accountStatus === 'premium')) {
          accountStatus = premiumData.accountStatus;
          console.log('Using premium status from cookie:', accountStatus);
        }
      } catch (e) {
        console.error('Failed to parse premium cookie:', e);
      }
    }
    
    // Abone durumunu kontrol et
    if (!accountStatus || accountStatus === 'free') {
      return NextResponse.json(
        { error: 'Premium subscription required for this operation' },
        { status: 403 }
      );
    }
    
    const userId = decodedToken.uid;
    
    // Get transaction ID
    const transactionId = params.id;
    
    try {
      // Clerk API üzerinden kullanıcıyı doğrula
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Get transaction from Firestore
      const transaction = await getTransactionFromFirestore(transactionId);
      
      if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }
      
      // Check if transaction belongs to the user
      if (transaction.userId !== userId) {
        return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
      }
      
      return NextResponse.json(transaction);
    } catch (apiError) {
      console.error('API error:', apiError);
      return NextResponse.json(
        { error: 'An error occurred while retrieving the transaction' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error getting transaction:', error);
    return NextResponse.json(
      { error: 'An error occurred while retrieving the transaction' },
      { status: 500 }
    );
  }
}

// Update transaction endpoint
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    // Check for premium account status - client taraflı premium cookie'yi de kontrol et
    const premiumCookie = request.cookies.get('user-premium-status')?.value;
    let accountStatus = decodedToken.accountStatus || 'free';
    
    // Cookie'den premium durumunu almaya çalış eğer token'da yoksa
    if ((accountStatus === 'free' || !accountStatus) && premiumCookie) {
      try {
        const premiumData = JSON.parse(premiumCookie);
        if (premiumData.accountStatus && 
            (premiumData.accountStatus === 'basic' || 
            premiumData.accountStatus === 'premium')) {
          accountStatus = premiumData.accountStatus;
          console.log('Using premium status from cookie:', accountStatus);
        }
      } catch (e) {
        console.error('Failed to parse premium cookie:', e);
      }
    }
    
    // Abone durumunu kontrol et
    if (!accountStatus || accountStatus === 'free') {
      return NextResponse.json(
        { error: 'Premium subscription required for this operation' },
        { status: 403 }
      );
    }
    
    const userId = decodedToken.uid;
    
    // Get transaction ID
    const transactionId = params.id;
    
    // Validate request body
    const requestData = await request.json();
    const validation = validateTransaction(requestData);
    
    if (!validation.valid) {
      return NextResponse.json({ 
        error: 'Invalid transaction data',
        details: validation.error
      }, { status: 400 });
    }
    
    try {
      // Ensure transaction exists and belongs to user
      const existingTransaction = await getTransactionFromFirestore(transactionId);
      
      if (!existingTransaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }
      
      if (existingTransaction.userId !== userId) {
        return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
      }
      
      // Update transaction in Firestore
      const updatedTransaction: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>> = {
        ticker: requestData.ticker,
        type: requestData.type,
        shares: requestData.shares,
        price: requestData.price,
        amount: requestData.amount,
        date: requestData.date,
        fee: requestData.fee,
        notes: requestData.notes
      };
      
      await updateTransactionInFirestore(transactionId, userId, updatedTransaction);
      
      return NextResponse.json({
        message: 'Transaction successfully updated',
        id: transactionId,
        updatedAt: new Date().toISOString()
      });
    } catch (apiError: any) {
      console.error('API error:', apiError);
      return NextResponse.json(
        { error: apiError.message || 'An error occurred while updating the transaction' },
        { status: apiError.message?.includes('Unauthorized') ? 403 : 500 }
      );
    }
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating the transaction' },
      { status: 500 }
    );
  }
}

// Delete transaction endpoint
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    // Check for premium account status - client taraflı premium cookie'yi de kontrol et
    const premiumCookie = request.cookies.get('user-premium-status')?.value;
    let accountStatus = decodedToken.accountStatus || 'free';
    
    // Cookie'den premium durumunu almaya çalış eğer token'da yoksa
    if ((accountStatus === 'free' || !accountStatus) && premiumCookie) {
      try {
        const premiumData = JSON.parse(premiumCookie);
        if (premiumData.accountStatus && 
            (premiumData.accountStatus === 'basic' || 
            premiumData.accountStatus === 'premium')) {
          accountStatus = premiumData.accountStatus;
          console.log('Using premium status from cookie:', accountStatus);
        }
      } catch (e) {
        console.error('Failed to parse premium cookie:', e);
      }
    }
    
    // Abone durumunu kontrol et
    if (!accountStatus || accountStatus === 'free') {
      return NextResponse.json(
        { error: 'Premium subscription required for this operation' },
        { status: 403 }
      );
    }
    
    const userId = decodedToken.uid;
    const transactionId = params.id;
    
    try {
      // Delete transaction from Firestore
      await deleteTransactionFromFirestore(transactionId, userId);
      
      return NextResponse.json({
        message: 'Transaction successfully deleted',
        id: transactionId
      });
    } catch (apiError: any) {
      console.error('API error:', apiError);
      
      if (apiError.message?.includes('not found')) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }
      
      if (apiError.message?.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
      }
      
      return NextResponse.json(
        { error: 'An error occurred while deleting the transaction' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting the transaction' },
      { status: 500 }
    );
  }
} 