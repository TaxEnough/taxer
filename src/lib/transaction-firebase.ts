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
    const transactionsRef = collection(db, TRANSACTIONS_COLLECTION);
    const q = query(
      transactionsRef,
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
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
    const transactionsRef = collection(db, TRANSACTIONS_COLLECTION);
    
    // Prepare transaction data with timestamps
    const transactionData = {
      ...transaction,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(transactionsRef, transactionData);
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
    const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Transaction not found');
    }
    
    // Security check - verify the transaction belongs to the user
    if (docSnap.data().userId !== userId) {
      throw new Error('Unauthorized: This transaction does not belong to this user');
    }
    
    // Update transaction with timestamp
    await updateDoc(docRef, {
      ...transaction,
      updatedAt: serverTimestamp()
    });
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
    const docRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Transaction not found');
    }
    
    // Security check - verify the transaction belongs to the user
    if (docSnap.data().userId !== userId) {
      throw new Error('Unauthorized: This transaction does not belong to this user');
    }
    
    await deleteDoc(docRef);
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
    
    await batch.commit();
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
    const transactions = await getUserTransactionsFromFirestore(userId);
    
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
            totalCost: 0,
            averageCost: 0,
            remainingShares: 0,
            currentValue: 0,
            totalProfit: 0
          }
        };
      }
      
      groupedTransactions[ticker].transactions.push(transaction);
    });
    
    // Calculate summary for each ticker
    Object.keys(groupedTransactions).forEach(ticker => {
      const tickerData = groupedTransactions[ticker];
      const transactions = tickerData.transactions;
      
      let totalBuyShares = 0;
      let totalBuyCost = 0;
      let totalSellShares = 0;
      let totalSellProceeds = 0;
      
      transactions.forEach((tx: Transaction) => {
        if (tx.type === 'buy') {
          totalBuyShares += tx.shares;
          totalBuyCost += tx.amount + (tx.fee || 0);
        } else if (tx.type === 'sell') {
          totalSellShares += tx.shares;
          totalSellProceeds += tx.amount - (tx.fee || 0);
        }
      });
      
      const remainingShares = totalBuyShares - totalSellShares;
      const averageCost = totalBuyShares > 0 ? totalBuyCost / totalBuyShares : 0;
      
      // Calculate profit based on average cost
      let totalProfit = 0;
      transactions.filter((tx: Transaction) => tx.type === 'sell').forEach((tx: Transaction) => {
        const costBasis = tx.shares * averageCost;
        const proceeds = tx.amount - (tx.fee || 0);
        totalProfit += proceeds - costBasis;
      });
      
      // Update summary
      tickerData.summary = {
        totalShares: totalBuyShares,
        totalCost: totalBuyCost,
        averageCost,
        remainingShares,
        currentValue: remainingShares * averageCost, // This will be updated with current price if available
        totalProfit
      };
    });
    
    return groupedTransactions;
  } catch (error) {
    console.error('Error fetching transactions by ticker:', error);
    throw error;
  }
} 