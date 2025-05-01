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
    const userId = decodedToken.uid;
    
    // Check transaction access
    const transactionId = params.id;
    const hasAccess = await checkTransactionAccess(transactionId, userId);
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    
    // Get transaction document
    const transactionDoc = await db.collection('transactions').doc(transactionId).get();
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
    const userId = decodedToken.uid;
    
    // Check transaction access
    const transactionId = params.id;
    const hasAccess = await checkTransactionAccess(transactionId, userId);
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    
    // Validate request body
    const requestData = await request.json();
    const validation = validateTransaction(requestData);
    
    if (!validation.valid) {
      return NextResponse.json({ 
        error: 'Invalid transaction data',
        details: validation.error
      }, { status: 400 });
    }
    
    // Get existing transaction
    const transactionRef = db.collection('transactions').doc(transactionId);
    const transactionDoc = await transactionRef.get();
    const existingData = transactionDoc.data() as Transaction;
    
    // Prepare update data
    const updateData: Partial<Transaction> = {
      ...requestData,
      updatedAt: new Date().toISOString(),
      userId // Ensure userId is preserved
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
    
    // Update transaction type (if buy or sell date changed)
    if (
      (existingData.type === 'buy' || existingData.type === 'sell') &&
      requestData.date !== undefined &&
      requestData.date !== existingData.date
    ) {
      // Logic for date-based type changes if needed
    }
    
    // Update the transaction
    await transactionRef.update(updateData);
    
    // Return updated transaction
    const updatedDoc = await transactionRef.get();
    const updatedData = updatedDoc.data() as Transaction;
    
    return NextResponse.json({
      ...updatedData,
      id: transactionId
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
    // Try to get user ID through session cookie first
    let userId: string | null = null;
    
    // Extract token from Authorization header as fallback
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      
      if (idToken && idToken !== 'undefined' && idToken.length > 20) {
        try {
          const decodedToken = await auth.verifyIdToken(idToken);
          userId = decodedToken.uid;
          console.log(`User authenticated via token: ${userId}`);
        } catch (error) {
          const tokenError = error as Error;
          console.error('Token verification failed:', tokenError.message);
          // Continue to try session cookie
        }
      }
    }
    
    // If no user ID from token, try to get through session cookie
    if (!userId) {
      try {
        // Get session cookie
        const sessionCookie = request.cookies.get('session')?.value;
        
        if (sessionCookie) {
          // Verify session cookie
          const decodedClaims = await auth.verifySessionCookie(sessionCookie);
          userId = decodedClaims.uid;
          console.log(`User authenticated via session cookie: ${userId}`);
        }
      } catch (error) {
        const cookieError = error as Error;
        console.error('Session cookie verification failed:', cookieError.message);
      }
    }
    
    // If still no userId, check Firebase session ID in cookies
    if (!userId) {
      try {
        const firebaseToken = request.cookies.get('firebase-session-token')?.value;
        if (firebaseToken) {
          const decodedToken = await auth.verifyIdToken(firebaseToken);
          userId = decodedToken.uid;
          console.log(`User authenticated via firebase cookie: ${userId}`);
        }
      } catch (error) {
        const fbError = error as Error;
        console.error('Firebase cookie verification failed:', fbError.message);
      }
    }
    
    // Last attempt - try to get auth token from custom header
    if (!userId) {
      const customHeader = request.headers.get('x-auth-token');
      if (customHeader) {
        try {
          const decodedToken = await auth.verifyIdToken(customHeader);
          userId = decodedToken.uid;
          console.log(`User authenticated via custom header: ${userId}`);
        } catch (error) {
          const headerError = error as Error;
          console.error('Custom header verification failed:', headerError.message);
        }
      }
    }
    
    // If still no userId, authentication failed
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }
    
    // Get transaction ID from params
    const transactionId = params.id;
    console.log(`Attempting to delete transaction ${transactionId} for user ${userId}`);
    
    // Simply try to delete without ownership verification for now
    try {
      await db.collection('transactions').doc(transactionId).delete();
      
      return NextResponse.json({
        message: 'Transaction successfully deleted',
        id: transactionId
      });
    } catch (error) {
      const deleteError = error as Error;
      console.error('Error deleting transaction:', deleteError.message);
      return NextResponse.json(
        { error: 'Failed to delete transaction' },
        { status: 500 }
      );
    }
  } catch (error) {
    const serverError = error as Error;
    console.error('Delete transaction error:', serverError.message);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 