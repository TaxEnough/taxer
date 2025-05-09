import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, addDoc, updateDoc, deleteDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { verifyToken } from '@/lib/auth-firebase';

// API rotasını dinamik olarak işaretliyoruz
export const dynamic = 'force-dynamic';

// İşlem arayüzü
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

// İşlem ekleme/güncelleme için doğrulama
function validateTransaction(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.stock) errors.push('Stock symbol is required');
  if (!data.buyDate) errors.push('Purchase date is required');
  if (!data.buyPrice || isNaN(Number(data.buyPrice))) errors.push('Valid purchase price is required');
  if (!data.sellDate) errors.push('Sale date is required');
  if (!data.sellPrice || isNaN(Number(data.sellPrice))) errors.push('Valid sale price is required');
  if (!data.quantity || isNaN(Number(data.quantity)) || Number(data.quantity) <= 0) errors.push('Valid quantity is required');
  
  // Satış tarihinin alış tarihinden sonra olduğunu kontrol et
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

// İşlemleri getirme endpoint'i
export async function GET(request: NextRequest) {
  try {
    // Query parametrelerini al
    const { searchParams } = new URL(request.url);
    const stock = searchParams.get('stock');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const countOnly = searchParams.get('count') === 'true';
    
    // Authorization header'dan token'ı al
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization failed' }, { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Token'ı doğrula
    const decodedToken = await verifyToken(token);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Kullanıcının abonelik durumunu kontrol et
    if (!decodedToken.accountStatus || decodedToken.accountStatus === 'free') {
      return NextResponse.json({ error: 'Bu işlem için premium abonelik gereklidir' }, { status: 403 });
    }
    
    const userId = decodedToken.uid;
    
    // İşlemleri getir
    const transactionsRef = collection(db, 'users', userId, 'transactions');
    
    // Filtreleri uygula
    let transactionsQuery = query(transactionsRef, orderBy('sellDate', 'desc'));
    
    // Firestore'da filtreleme yapılamıyorsa (client-side yapılır)
    const transactionsSnap = await getDocs(transactionsQuery);
    
    if (transactionsSnap.empty) {
      if (countOnly) {
        return NextResponse.json({ count: 0 });
      }
      return NextResponse.json([]);
    }
    
    // Eğer sadece sayı isteniyorsa, sayısını döndür
    if (countOnly) {
      return NextResponse.json({ count: transactionsSnap.size });
    }
    
    // İşlemleri diziye dönüştür
    let transactions: Transaction[] = [];
    transactionsSnap.forEach(doc => {
      transactions.push({
        id: doc.id,
        ...doc.data() as Transaction
      });
    });
    
    // Client-side filtreleme
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
      toDate.setHours(23, 59, 59, 999); // Günün sonuna ayarla
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

// Yeni işlem ekleme endpoint'i
export async function POST(request: NextRequest) {
  try {
    // İstek gövdesini al
    const requestData = await request.json();
    
    // Authorization header'dan token'ı al
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization failed' }, { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Token'ı doğrula
    const decodedToken = await verifyToken(token);
    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Kullanıcının abonelik durumunu kontrol et
    if (!decodedToken.accountStatus || decodedToken.accountStatus === 'free') {
      return NextResponse.json({ error: 'Bu işlem için premium abonelik gereklidir' }, { status: 403 });
    }
    
    const userId = decodedToken.uid;
    
    // Giriş doğrulama
    const validation = validateTransaction(requestData);
    if (!validation.valid) {
      return NextResponse.json({ 
        error: 'Invalid transaction data', 
        details: validation.errors 
      }, { status: 400 });
    }
    
    // Sayısal değerleri düzelt
    const buyPrice = Number(requestData.buyPrice);
    const sellPrice = Number(requestData.sellPrice);
    const quantity = Number(requestData.quantity);
    const tradingFees = requestData.tradingFees ? Number(requestData.tradingFees) : 0;
    
    // Kar/zarar hesaplama
    const profit = (sellPrice - buyPrice) * quantity - tradingFees;
    
    // İşlem tipini belirle (kısa/uzun vadeli)
    const buyDateObj = new Date(requestData.buyDate);
    const sellDateObj = new Date(requestData.sellDate);
    const holdingPeriodMonths = (sellDateObj.getFullYear() - buyDateObj.getFullYear()) * 12 + 
                               (sellDateObj.getMonth() - buyDateObj.getMonth());
    
    const type = holdingPeriodMonths >= 12 ? 'Long Term' : 'Short Term';
    
    // Yeni işlem dokümanı
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
    
    // Firestore'a kaydet
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