import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, addDoc, updateDoc, deleteDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { verifyToken } from '@/lib/auth-firebase';

// Mark API route as dynamic
export const dynamic = 'force-dynamic';

// Transaction interface
interface Transaction {
  id?: string;
  stock: string;
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  quantity: number;
  profit?: number;
  type?: string;
  tradingFees?: number;
  note?: string;
  createdAt?: any;
  updatedAt?: any;
}

// Transaction validation for add/update
function validateTransaction(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.stock) errors.push('Stock symbol is required');
  if (!data.buyDate) errors.push('Purchase date is required');
  if (!data.buyPrice || isNaN(Number(data.buyPrice))) errors.push('Valid purchase price is required');
  if (!data.sellDate) errors.push('Sale date is required');
  if (!data.sellPrice || isNaN(Number(data.sellPrice))) errors.push('Valid sale price is required');
  if (!data.quantity || isNaN(Number(data.quantity)) || Number(data.quantity) <= 0) errors.push('Valid quantity is required');
  
  // Check if sale date is after purchase date
  const buyDate = new Date(data.buyDate);
  const sellDate = new Date(data.sellDate);
  
  if (buyDate > sellDate) {
    errors.push('Sale date must be after purchase date');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Get transactions endpoint
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const stock = searchParams.get('stock');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const countOnly = searchParams.get('count') === 'true';
    
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization failed' }, { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decodedToken = await verifyToken(token);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Check user subscription status - client taraflı premium cookie'yi kontrol et
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
      return NextResponse.json({ error: 'Premium subscription required for this operation' }, { status: 403 });
    }
    
    const userId = decodedToken.uid;
    
    // Get transactions
    const transactionsRef = collection(db, 'users', userId, 'transactions');
    
    // Apply filters
    let transactionsQuery = query(transactionsRef, orderBy('sellDate', 'desc'));
    
    // If filtering can't be done in Firestore (done client-side)
    const transactionsSnap = await getDocs(transactionsQuery);
    
    if (transactionsSnap.empty) {
      if (countOnly) {
        return NextResponse.json({ count: 0 });
      }
      return NextResponse.json([]);
    }
    
    // If only count is requested, return count
    if (countOnly) {
      return NextResponse.json({ count: transactionsSnap.size });
    }
    
    // Convert transactions to array
    let transactions: Transaction[] = [];
    transactionsSnap.forEach(doc => {
      transactions.push({
        id: doc.id,
        ...doc.data() as Transaction
      });
    });
    
    // Client-side filtering
    if (stock) {
      transactions = transactions.filter(tx => tx.stock.toUpperCase() === stock.toUpperCase());
    }
    
    if (type) {
      transactions = transactions.filter(tx => tx.type === type);
    }
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      transactions = transactions.filter(tx => new Date(tx.sellDate) >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Set to end of day
      transactions = transactions.filter(tx => new Date(tx.sellDate) <= toDate);
    }
    
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error retrieving transactions:', error);
    return NextResponse.json(
      { error: 'An error occurred while retrieving transactions' },
      { status: 500 }
    );
  }
}

// Add new transaction endpoint
export async function POST(request: NextRequest) {
  try {
    // Get request body
    const requestData = await request.json();
    
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization failed' }, { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decodedToken = await verifyToken(token);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Check user subscription status - client taraflı premium cookie'yi kontrol et
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
      return NextResponse.json({ error: 'Premium subscription required for this operation' }, { status: 403 });
    }
    
    const userId = decodedToken.uid;
    
    // Validate input
    const validation = validateTransaction(requestData);
    if (!validation.valid) {
      return NextResponse.json({ 
        error: 'Invalid transaction data', 
        details: validation.errors 
      }, { status: 400 });
    }
    
    // Fix numeric values
    const buyPrice = Number(requestData.buyPrice);
    const sellPrice = Number(requestData.sellPrice);
    const quantity = Number(requestData.quantity);
    const tradingFees = requestData.tradingFees ? Number(requestData.tradingFees) : 0;
    
    // Calculate profit/loss
    const profit = (sellPrice - buyPrice) * quantity - tradingFees;
    
    // Determine transaction type (short/long term)
    const buyDateObj = new Date(requestData.buyDate);
    const sellDateObj = new Date(requestData.sellDate);
    const holdingPeriodMonths = (sellDateObj.getFullYear() - buyDateObj.getFullYear()) * 12 + 
                               (sellDateObj.getMonth() - buyDateObj.getMonth());
    
    const type = holdingPeriodMonths >= 12 ? 'Long Term' : 'Short Term';
    
    // New transaction document
    const newTransaction: Transaction = {
      stock: requestData.stock.toUpperCase(),
      buyDate: requestData.buyDate,
      buyPrice,
      sellDate: requestData.sellDate,
      sellPrice,
      quantity,
      profit,
      type,
      tradingFees,
      note: requestData.note || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Save to Firestore
    const transactionsRef = collection(db, 'users', userId, 'transactions');
    const docRef = await addDoc(transactionsRef, newTransaction);
    
    return NextResponse.json({ 
      id: docRef.id,
      ...newTransaction,
      createdAt: new Date(),
      updatedAt: new Date()
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding transaction:', error);
    return NextResponse.json(
      { error: 'An error occurred while adding the transaction' },
      { status: 500 }
    );
  }
} 