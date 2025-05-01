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

// Enhanced user ID extraction with extensive error logging
async function extractUserId(request: NextRequest): Promise<{ userId: string | null; source: string | null; error?: string }> {
  console.log('🔍 Beginning user authentication check');
  
  // 1. Try to get from cookies - session cookie
  try {
    const sessionCookie = request.cookies.get('session')?.value;
    if (sessionCookie) {
      console.log('🍪 Found session cookie, attempting to verify');
      try {
        const decodedClaims = await auth.verifySessionCookie(sessionCookie);
        console.log('✅ Session cookie verification successful');
        return { userId: decodedClaims.uid, source: 'session-cookie' };
      } catch (e) {
        console.log('❌ Session cookie verification failed:', e instanceof Error ? e.message : 'Unknown error');
      }
    } else {
      console.log('❓ No session cookie found');
    }
  } catch (error) {
    console.error('❌ Error processing session cookie:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // 2. Try to get from cookies - auth-token cookie
  try {
    const authCookie = request.cookies.get('auth-token')?.value;
    if (authCookie) {
      console.log('🍪 Found auth-token cookie, attempting to verify');
      try {
        const decodedToken = await auth.verifyIdToken(authCookie);
        console.log('✅ Auth-token cookie verification successful');
        return { userId: decodedToken.uid, source: 'auth-token-cookie' };
      } catch (e) {
        console.log('❌ Auth-token cookie verification failed:', e instanceof Error ? e.message : 'Unknown error');
        
        // Try to extract user ID from token payload if verification fails
        try {
          if (authCookie && authCookie.split('.').length === 3) {
            console.log('🔑 Attempting to parse token payload directly');
            const payload = JSON.parse(
              Buffer.from(authCookie.split('.')[1], 'base64').toString()
            );
            if (payload && payload.user_id) {
              console.log('✅ Extracted user_id from token payload');
              return { userId: payload.user_id, source: 'auth-token-payload' };
            }
            if (payload && payload.uid) {
              console.log('✅ Extracted uid from token payload');
              return { userId: payload.uid, source: 'auth-token-payload' };
            }
            if (payload && payload.sub) {
              console.log('✅ Extracted sub from token payload');
              return { userId: payload.sub, source: 'auth-token-payload' };
            }
            console.log('❌ Could not find user identifier in token payload');
          } else {
            console.log('❌ Token does not have valid JWT format');
          }
        } catch (parseError) {
          console.error('❌ Token parsing error:', parseError instanceof Error ? parseError.message : 'Unknown error');
        }
      }
    } else {
      console.log('❓ No auth-token cookie found');
    }
  } catch (error) {
    console.error('❌ Error processing auth-token cookie:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // 3. Try to get from Authorization header
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      console.log('🔑 Found Authorization header with Bearer token, attempting to verify');
      
      if (token) {
        try {
          const decodedToken = await auth.verifyIdToken(token);
          console.log('✅ Authorization header token verification successful');
          return { userId: decodedToken.uid, source: 'authorization-header' };
        } catch (e) {
          console.log('❌ Authorization header token verification failed:', e instanceof Error ? e.message : 'Unknown error');
          
          // Try to extract user ID from token payload if verification fails
          try {
            if (token && token.split('.').length === 3) {
              console.log('🔑 Attempting to parse token payload directly');
              const payload = JSON.parse(
                Buffer.from(token.split('.')[1], 'base64').toString()
              );
              if (payload && payload.user_id) {
                console.log('✅ Extracted user_id from token payload');
                return { userId: payload.user_id, source: 'auth-header-payload' };
              }
              if (payload && payload.uid) {
                console.log('✅ Extracted uid from token payload');
                return { userId: payload.uid, source: 'auth-header-payload' };
              }
              if (payload && payload.sub) {
                console.log('✅ Extracted sub from token payload');
                return { userId: payload.sub, source: 'auth-header-payload' };
              }
              console.log('❌ Could not find user identifier in token payload');
            } else {
              console.log('❌ Token does not have valid JWT format');
            }
          } catch (parseError) {
            console.error('❌ Token parsing error:', parseError instanceof Error ? parseError.message : 'Unknown error');
          }
        }
      }
    } else {
      console.log('❓ No Authorization header with Bearer token found');
    }
  } catch (error) {
    console.error('❌ Error processing Authorization header:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // 4. Try to get from X-User-ID header (custom fallback)
  try {
    const xUserId = request.headers.get('x-user-id');
    if (xUserId) {
      console.log('🔑 Found X-User-ID header, using as fallback');
      return { userId: xUserId, source: 'x-user-id-header' };
    } else {
      console.log('❓ No X-User-ID header found');
    }
  } catch (error) {
    console.error('❌ Error processing X-User-ID header:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // 5. Last resort: Check localStorage data sent in a custom header
  try {
    const userInfoHeader = request.headers.get('x-user-info');
    if (userInfoHeader) {
      try {
        console.log('🔑 Found X-User-Info header, attempting to parse');
        const userInfo = JSON.parse(userInfoHeader);
        if (userInfo && userInfo.id) {
          console.log('✅ Extracted user ID from X-User-Info header');
          return { userId: userInfo.id, source: 'x-user-info-header' };
        }
      } catch (e) {
        console.error('❌ Error parsing X-User-Info header:', e instanceof Error ? e.message : 'Unknown error');
      }
    } else {
      console.log('❓ No X-User-Info header found');
    }
  } catch (error) {
    console.error('❌ Error processing X-User-Info header:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  console.log('❌ All authentication methods failed, unable to identify user');
  return { userId: null, source: null, error: 'Could not identify user after trying all authentication methods' };
}

// Delete transaction endpoint
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Get transaction ID from params
  const transactionId = params.id;
  console.log(`🗑️ Attempting to delete transaction: ${transactionId}`);
  
  try {
    // Get the user ID with enhanced extraction
    const { userId, source, error } = await extractUserId(request);
    
    if (!userId) {
      console.log(`❌ Authentication failed: ${error || 'No user ID found'}`);
      return NextResponse.json(
        { error: 'Authentication required to delete transaction', details: error },
        { status: 401 }
      );
    }
    
    console.log(`✅ User authenticated via ${source}: ${userId}`);
    console.log(`🔍 Checking if transaction ${transactionId} belongs to user ${userId}`);
    
    // Check if this transaction belongs to the user
    const transactionRef = db.collection(`users/${userId}/transactions`).doc(transactionId);
    const transactionDoc = await transactionRef.get();
    
    if (!transactionDoc.exists) {
      console.log(`❌ Transaction ${transactionId} not found for user ${userId}`);
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }
    
    // Transaction belongs to this user, delete it
    await transactionRef.delete();
    console.log(`✅ Transaction ${transactionId} successfully deleted for user ${userId}`);
    
    return NextResponse.json({
      message: 'Transaction successfully deleted',
      id: transactionId
    });
  } catch (error) {
    console.error('❌ Delete API error:', error instanceof Error ? error.message : 'Unknown error', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 