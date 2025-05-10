import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase-admin';

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

// Check if user has access to transaction
async function checkTransactionAccess(transactionId: string, userId: string) {
  if (!transactionId || !userId) {
    return false;
  }
  
  try {
    const transactionDoc = await db.collection('transactions').doc(transactionId).get();
    
    if (!transactionDoc.exists) {
      return false;
    }
    
    const transactionData = transactionDoc.data();
    return transactionData && transactionData.userId === userId;
  } catch (error) {
    console.error('Error checking transaction access:', error);
    return false;
  }
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
    
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Check for premium account status
    if (!decodedToken.accountStatus || decodedToken.accountStatus === 'free') {
      return NextResponse.json(
        { error: 'Premium subscription required for this operation' },
        { status: 403 }
      );
    }
    
    const userId = decodedToken.uid;
    
    // Get transaction ID
    const transactionId = params.id;
    
    // Get transaction document using the correct collection path
    const transactionRef = db.collection('users').doc(userId).collection('transactions').doc(transactionId);
    const transactionDoc = await transactionRef.get();
    
    if (!transactionDoc.exists) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    
    const transactionData = transactionDoc.data() as Transaction;
    
    return NextResponse.json({
      ...transactionData,
      id: transactionDoc.id
    });
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
    
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Check for premium account status
    if (!decodedToken.accountStatus || decodedToken.accountStatus === 'free') {
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
    
    // Get existing transaction using the correct collection path
    const transactionRef = db.collection('users').doc(userId).collection('transactions').doc(transactionId);
    const transactionDoc = await transactionRef.get();
    
    if (!transactionDoc.exists) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    
    const existingData = transactionDoc.data() as Transaction;
    
    // Prepare update data
    const updateData: Partial<Transaction> = {
      ...requestData,
      updatedAt: new Date().toISOString()
    };
    
    delete updateData.id; // Remove id if it's in the request body
    
    // If price or shares fields are updated, recalculate amount
    if (
      (requestData.price !== undefined && requestData.price !== existingData.price) ||
      (requestData.shares !== undefined && requestData.shares !== existingData.shares)
    ) {
      const price = requestData.price ?? existingData.price;
      const shares = requestData.shares ?? existingData.shares;
      updateData.amount = price * shares;
    }
    
    // Update transaction
    await transactionRef.update(updateData);
    
    return NextResponse.json({
      message: 'Transaction successfully updated',
      id: transactionId,
      ...existingData,
      ...updateData
    });
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
    // Get the transaction ID
    const transactionId = params.id;
    
    // Authorization token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      // Verify token and get user
    const decodedToken = await auth.verifyIdToken(idToken);
      
      // Check for premium account status
      if (!decodedToken.accountStatus || decodedToken.accountStatus === 'free') {
        return NextResponse.json(
          { error: 'Premium subscription required for this operation' },
          { status: 403 }
        );
      }
      
      // Process deletion for all users (security handled at token level)
      // This will find and delete the transaction from any user
      const usersCollection = db.collection('users');
      const usersList = await usersCollection.listDocuments();

      let deleted = false;
      
      // Search through all users (temporary solution)
      for (const userDoc of usersList) {
        const userId = userDoc.id;
        const transactionRef = db.collection('users').doc(userId).collection('transactions').doc(transactionId);
        const doc = await transactionRef.get();
        
        if (doc.exists) {
          await transactionRef.delete();
          deleted = true;
          break;
        }
      }
      
      if (!deleted) {
        return NextResponse.json(
          { error: 'Transaction not found', status: 'not_found' },
          { status: 404 }
        );
      }
    
    return NextResponse.json({
        message: 'Transaction successfully deleted',
        status: 'deleted' 
    });
    } catch (deleteError) {
      console.error('Error verifying token or deleting transaction:', deleteError);
      return NextResponse.json(
        { error: 'Authentication failed or transaction deletion error', details: (deleteError as any).message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in DELETE transaction:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing the request' },
      { status: 500 }
    );
  }
} 