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
    let userId = null;
    
    // Öncelikle auth-token cookie'sini kontrol et
    const authCookie = request.cookies.get('auth-token')?.value;
    
    if (authCookie) {
      try {
        // Auth cookie'yi doğrula
        const decodedToken = await auth.verifyIdToken(authCookie);
        userId = decodedToken.uid;
        console.log(`Silme işlemi: Cookie ile kimlik doğrulandı. Kullanıcı ID: ${userId}`);
      } catch (error) {
        console.error('Cookie token doğrulama hatası:', error);
      }
    }
    
    // Cookie ile kimlik doğrulama başarısız olduysa, Authorization header'ı kontrol et
    if (!userId) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1];
        if (token && token.length > 20) {
          try {
            const decodedToken = await auth.verifyIdToken(token);
            userId = decodedToken.uid;
            console.log(`Silme işlemi: Bearer token ile kimlik doğrulandı. Kullanıcı ID: ${userId}`);
          } catch (error) {
            console.error('Bearer token doğrulama hatası:', error);
          }
        }
      }
    }
    
    // Hala userId yoksa, kimlik doğrulama başarısız
    if (!userId) {
      console.error('Silme işlemi için kimlik doğrulama başarısız');
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }
    
    // İşlem ID'sini al
    const transactionId = params.id;
    console.log(`İşlem siliniyor: ${transactionId}, Kullanıcı: ${userId}`);
    
    // İşlemi sil
    try {
      await db.collection('transactions').doc(transactionId).delete();
      
      return NextResponse.json({
        message: 'Transaction successfully deleted',
        id: transactionId
      });
    } catch (error) {
      console.error('İşlem silme hatası:', error);
      return NextResponse.json(
        { error: 'Failed to delete transaction' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Silme API hatası:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 