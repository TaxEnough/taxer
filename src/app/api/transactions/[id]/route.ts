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
    // Get and validate token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    
    // Log token metadata for debugging (güvenlik için sadece ilk ve son 10 karakterini göster)
    const tokenLength = idToken.length;
    console.log(`Token uzunluğu: ${tokenLength}, İlk 10: ${idToken.substring(0, 10)}..., Son 10: ${idToken.substring(tokenLength - 10)}`);
    
    // Token formatını basit şekilde kontrol et
    if (!idToken || idToken.split('.').length !== 3) {
      console.error('Token format hatası: Geçersiz JWT formatı');
      return NextResponse.json(
        { 
          error: 'Oturum bilginiz hatalı. Lütfen tekrar giriş yapın.', 
          details: 'Invalid token format',
          code: 'auth/invalid-token-format'
        },
        { status: 401 }
      );
    }
    
    try {
      // Token doğrulama işlemini ayrı bir try-catch bloğunda yap
      // checkRevoked parametresini false olarak ayarla
      const decodedToken = await auth.verifyIdToken(idToken, false);
      const userId = decodedToken.uid;
      
      // Check transaction access
      const transactionId = params.id;
      const hasAccess = await checkTransactionAccess(transactionId, userId);
      
      if (!hasAccess) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }
      
      // Delete the transaction
      await db.collection('transactions').doc(transactionId).delete();
      
      return NextResponse.json({
        message: 'Transaction successfully deleted'
      });
    } catch (tokenError: any) {
      console.error('Token doğrulama hatası:', tokenError);
      console.error('Hata detayları:', tokenError.code, tokenError.message);
      
      // Daha spesifik hata mesajları
      let errorMessage = 'Token doğrulama hatası oluştu.';
      let statusCode = 401;
      
      if (tokenError.code === 'auth/argument-error' && tokenError.message.includes('no "kid" claim')) {
        errorMessage = 'İşlem için yetkilendirme başarısız oldu. Sayfayı yenileyip tekrar deneyiniz.';
      } else if (tokenError.code === 'auth/id-token-expired') {
        errorMessage = 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.';
      } else if (tokenError.code === 'auth/id-token-revoked') {
        errorMessage = 'Oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.';
      }
      
      // Token hatası için daha açıklayıcı bir yanıt dön
      return NextResponse.json(
        { 
          error: errorMessage, 
          details: tokenError.message,
          code: tokenError.code || 'unknown_error'
        },
        { status: statusCode }
      );
    }
  } catch (error: any) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { 
        error: 'İşlem silinirken bir hata oluştu',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
} 