import { db } from './firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  Timestamp, 
  writeBatch
} from 'firebase/firestore';
import { Transaction } from '@/types/transaction';

// Collection reference
const TRANSACTIONS_COLLECTION = 'transactions';

/**
 * Get all transactions for a specific user
 * @param userId - The user ID to fetch transactions for
 * @returns Array of transactions for the user
 */
export async function getUserTransactionsFromFirestore(userId: string): Promise<Transaction[]> {
  try {
    console.log('Firestore\'dan işlemler alınıyor, userId:', userId);
    
    const transactionsRef = collection(db, TRANSACTIONS_COLLECTION);
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    
    console.log('Firestore sorgusu oluşturuldu:', {
      collection: TRANSACTIONS_COLLECTION,
      userId: userId,
      orderBy: 'date desc'
    });
    
    const querySnapshot = await getDocs(q);
    
    console.log(`Firestore sorgusu tamamlandı: ${querySnapshot.docs.length} sonuç bulundu`);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convert Firestore timestamp to ISO string if needed
      const date = data.date instanceof Timestamp 
        ? data.date.toDate().toISOString().split('T')[0]
        : data.date;
        
      return {
        id: doc.id,
        date,
        ticker: data.ticker,
        type: data.type,
        shares: data.shares,
        price: data.price,
        amount: data.amount,
        fee: data.fee || 0,
        notes: data.notes || '',
        createdAt: data.createdAt?.toDate().toISOString() || '',
        updatedAt: data.updatedAt?.toDate().toISOString() || ''
      } as Transaction;
    });
  } catch (error) {
    console.error('Error fetching transactions from Firestore:', error);
    throw error;
  }
}

/**
 * Get a single transaction by ID
 * @param transactionId - The ID of the transaction to fetch
 * @returns The transaction object or null if not found
 */
export async function getTransactionFromFirestore(transactionId: string): Promise<Transaction | null> {
  try {
    const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = docSnap.data();
    
    // Convert Firestore timestamp to ISO string if needed
    const date = data.date instanceof Timestamp
      ? data.date.toDate().toISOString().split('T')[0]
      : data.date;
      
    return {
      id: docSnap.id,
      date,
      ticker: data.ticker,
      type: data.type,
      shares: data.shares,
      price: data.price,
      amount: data.amount,
      fee: data.fee || 0,
      notes: data.notes || '',
      createdAt: data.createdAt?.toDate().toISOString() || '',
      updatedAt: data.updatedAt?.toDate().toISOString() || ''
    } as Transaction;
  } catch (error) {
    console.error('Error fetching transaction from Firestore:', error);
    throw error;
  }
}

/**
 * Create a new transaction
 * @param userId - The user ID to associate with the transaction
 * @param transaction - The transaction data to create
 * @returns The ID of the newly created transaction
 */
export async function createTransactionInFirestore(
  userId: string, 
  transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    console.log('Firestore\'a yeni işlem kaydediliyor, userId:', userId);
    console.log('İşlem verileri:', JSON.stringify(transaction));
    
    const transactionsRef = collection(db, TRANSACTIONS_COLLECTION);
    
    // Prepare transaction data with timestamps
    const transactionData = {
      ...transaction,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log('İşlem verisi hazırlandı, userId ve timestamps eklendi');
    
    const docRef = await addDoc(transactionsRef, transactionData);
    console.log('İşlem başarıyla eklendi, doc ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating transaction in Firestore:', error);
    throw error;
  }
}

/**
 * Update an existing transaction
 * @param transactionId - The ID of the transaction to update
 * @param userId - The user ID (for security validation)
 * @param transaction - The updated transaction data
 */
export async function updateTransactionInFirestore(
  transactionId: string,
  userId: string,
  transaction: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  try {
    console.log('İşlem güncelleniyor, docId:', transactionId, 'userId:', userId);
    
    const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Transaction not found');
    }
    
    // Security check - verify the transaction belongs to the user
    if (docSnap.data().userId !== userId) {
      console.error('İzin hatası: İşlemin userId değeri ile giriş yapan kullanıcının ID\'si uyuşmuyor');
      console.error('İşlemdeki userId:', docSnap.data().userId);
      console.error('Kullanıcı ID:', userId);
      
      throw new Error('Unauthorized: This transaction does not belong to this user');
    }
    
    // Update transaction with timestamp
    await updateDoc(docRef, {
      ...transaction,
      updatedAt: serverTimestamp()
    });
    
    console.log('İşlem güncellendi');
  } catch (error) {
    console.error('Error updating transaction in Firestore:', error);
    throw error;
  }
}

/**
 * Delete a transaction
 * @param transactionId - The ID of the transaction to delete
 * @param userId - The user ID (for security validation)
 */
export async function deleteTransactionFromFirestore(
  transactionId: string,
  userId: string
): Promise<void> {
  try {
    console.log('İşlem siliniyor, docId:', transactionId, 'userId:', userId);
    
    const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Transaction not found');
    }
    
    // Security check - verify the transaction belongs to the user
    if (docSnap.data().userId !== userId) {
      console.error('İzin hatası: İşlemin userId değeri ile giriş yapan kullanıcının ID\'si uyuşmuyor');
      console.error('İşlemdeki userId:', docSnap.data().userId);
      console.error('Kullanıcı ID:', userId);
      
      throw new Error('Unauthorized: This transaction does not belong to this user');
    }
    
    await deleteDoc(docRef);
    console.log('İşlem silindi');
  } catch (error) {
    console.error('Error deleting transaction from Firestore:', error);
    throw error;
  }
}

/**
 * Create multiple transactions in batch
 * @param userId - The user ID to associate with the transactions
 * @param transactions - Array of transaction data to create
 * @returns The number of transactions created
 */
export async function createBatchTransactionsInFirestore(
  userId: string,
  transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<number> {
  try {
    console.log(`Toplu işlem ekleniyor, userId: ${userId}, işlem sayısı: ${transactions.length}`);
    
    const batch = writeBatch(db);
    
    transactions.forEach(transaction => {
      const newDocRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      batch.set(newDocRef, {
        ...transaction,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    
    console.log('Toplu işlem batch hazırlandı, commit yapılıyor');
    await batch.commit();
    console.log('Toplu işlem başarıyla eklendi');
    
    return transactions.length;
  } catch (error) {
    console.error('Error creating batch transactions in Firestore:', error);
    throw error;
  }
}

/**
 * Get all transactions for a specific user, grouped by ticker
 * @param userId - The user ID to fetch transactions for
 * @returns Transactions grouped by ticker with summary information
 */
export async function getTransactionsByTicker(userId: string) {
  try {
    // Kullanıcı işlemlerini getir
    const transactions = await getUserTransactionsFromFirestore(userId);
    
    // Eğer hiç işlem yoksa boş obje döndür
    if (!transactions || transactions.length === 0) {
      console.log('Kullanıcının hiç işlemi bulunamadı');
      return {}; // Boş obje dön
    }
    
    // Group transactions by ticker
    const groupedTransactions: {[key: string]: any} = {};
    
    transactions.forEach(transaction => {
      const { ticker } = transaction;
      
      if (!groupedTransactions[ticker]) {
        groupedTransactions[ticker] = {
          ticker,
          transactions: [],
          summary: {
            totalShares: 0,
            averageCost: 0,
            totalInvested: 0,
            totalFees: 0,
            currentHoldings: 0,
            // Eski API uyumluluğu için
            totalCost: 0,
            remainingShares: 0,
            currentValue: 0,
            totalProfit: 0
          }
        };
      }
      
      groupedTransactions[ticker].transactions.push(transaction);
      
      // Update summary based on transaction type
      const summary = groupedTransactions[ticker].summary;
      
      if (transaction.type === 'buy') {
        summary.totalShares += transaction.shares;
        summary.totalInvested += transaction.amount;
        summary.totalFees += transaction.fee || 0;
      } else if (transaction.type === 'sell') {
        summary.totalShares -= transaction.shares;
        // We don't subtract from totalInvested for sells, as that's for average cost
        summary.totalFees += transaction.fee || 0;
      }
      
      // Recalculate average cost if we have shares
      if (summary.totalShares > 0) {
        summary.averageCost = summary.totalInvested / summary.totalShares;
      }
      
      // Current holdings are the total shares we still have
      summary.currentHoldings = summary.totalShares;
      
      // Eski API uyumluluğu için
      summary.totalCost = summary.totalInvested;
      summary.remainingShares = summary.currentHoldings;
      summary.currentValue = summary.averageCost * summary.currentHoldings;
      
      // Tahmini kâr/zarar hesabı
      // Gerçek kâr/zarar hesabı için tüm satış işlemlerini analiz etmek gerekir
      summary.totalProfit = 0; // Başlangıçta sıfır, gerçek hesaplama eklenebilir
    });
    
    // Convert to array and sort by ticker
    return groupedTransactions;
  } catch (error) {
    console.error('Error getting transactions by ticker:', error);
    // Hata durumunda boş obje döndür - sayfa en azından yüklenebilsin
    return {}; 
  }
} 