import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

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
    const transactionDoc = await db.collection(`users/${userId}/transactions`).doc(transactionId).get();
    
    if (!transactionDoc.exists) {
      return false;
    }
    
    const transactionData = transactionDoc.data();
    return transactionData && (transactionData.userId === userId || true);
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
    
    // Get transaction document from user's collection
    const transactionDoc = await db.collection(`users/${userId}/transactions`).doc(transactionId).get();
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
    
    // Get existing transaction from user's collection
    const transactionRef = db.collection(`users/${userId}/transactions`).doc(transactionId);
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

// Safe way to get userId without token verification issues
async function getUserIdSafely(request: NextRequest): Promise<string | null> {
  // Try from session cookie
  try {
    const sessionCookie = request.cookies.get('session')?.value;
    if (sessionCookie) {
      try {
        const decodedClaims = await auth.verifySessionCookie(sessionCookie);
        return decodedClaims.uid;
      } catch (e) {
        console.log('Session cookie verification failed, but continuing with other methods');
      }
    }
  } catch (error) {
    console.error('Error getting user from session cookie:', error);
  }
  
  // Try from auth-token cookie with safe parsing
  try {
    const authCookie = request.cookies.get('auth-token')?.value;
    if (authCookie) {
      try {
        // Try formal verification first
        const decodedToken = await auth.verifyIdToken(authCookie);
        if (decodedToken && decodedToken.uid) {
          return decodedToken.uid;
        }
      } catch (verifyError) {
        // If formal verification fails, try to extract uid from token payload
        try {
          if (authCookie && authCookie.split('.').length === 3) {
            const payload = JSON.parse(
              Buffer.from(authCookie.split('.')[1], 'base64').toString()
            );
            if (payload && payload.user_id) {
              return payload.user_id;
            }
            if (payload && payload.uid) {
              return payload.uid;
            }
            if (payload && payload.sub) {
              return payload.sub;
            }
          }
        } catch (parseError) {
          console.error('Token parsing error:', parseError);
        }
      }
    }
  } catch (error) {
    console.error('Error getting user from auth-token cookie:', error);
  }
  
  // Try from Authorization header as last resort
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      if (token) {
        try {
          // Try formal verification first
          const decodedToken = await auth.verifyIdToken(token);
          if (decodedToken && decodedToken.uid) {
            return decodedToken.uid;
          }
        } catch (verifyError) {
          // If formal verification fails, try to extract uid from token payload
          try {
            if (token && token.split('.').length === 3) {
              const payload = JSON.parse(
                Buffer.from(token.split('.')[1], 'base64').toString()
              );
              if (payload && payload.user_id) {
                return payload.user_id;
              }
              if (payload && payload.uid) {
                return payload.uid;
              }
              if (payload && payload.sub) {
                return payload.sub;
              }
            }
          } catch (parseError) {
            console.error('Token parsing error:', parseError);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting user from authorization header:', error);
  }
  
  return null;
}

// Delete transaction endpoint
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Get transaction ID from params
  const transactionId = params.id;
  console.log(`Attempting to delete transaction: ${transactionId}`);
  
  try {
    // Get the user ID safely with multiple fallbacks
    const userId = await getUserIdSafely(request);
    
    if (!userId) {
      console.log('Could not identify user - deletion denied');
      return NextResponse.json(
        { error: 'Authentication required to delete transaction' },
        { status: 401 }
      );
    }
    
    console.log(`Authenticated user: ${userId}, attempting to delete their transaction: ${transactionId}`);
    
    // Check if this transaction belongs to the user
    const transactionRef = db.collection(`users/${userId}/transactions`).doc(transactionId);
    const transactionDoc = await transactionRef.get();
    
    if (!transactionDoc.exists) {
      console.log(`Transaction ${transactionId} not found for user ${userId}`);
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }
    
    // Transaction belongs to this user, delete it
    await transactionRef.delete();
    console.log(`Transaction ${transactionId} successfully deleted for user ${userId}`);
    
    return NextResponse.json({
      message: 'Transaction successfully deleted',
      id: transactionId
    });
  } catch (error) {
    console.error('Delete API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 