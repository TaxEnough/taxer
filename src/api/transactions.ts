import { Transaction } from '@/types/transaction';
import { getAuthTokenFromClient } from '@/lib/auth-client';

/**
 * Kullanıcıya ait tüm işlemleri getirir
 * @returns İşlem listesi - Tarih sırasına göre sıralanmış kullanıcının tüm işlemleri
 */
export async function getUserTransactions(): Promise<Transaction[]> {
  try {
    const token = await getAuthTokenFromClient();
    if (!token) {
      throw new Error('Authentication failed: No valid token');
    }
    
    const response = await fetch('/api/transactions', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch transactions');
    }
    
    const transactions = await response.json();
    return transactions;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

/**
 * Belirli bir kullanıcı işlemini ID'ye göre getirir
 * @param transactionId İşlem ID'si - Benzersiz belge kimliği
 * @returns İşlem detayları - Bulunan işlem veya işlem bulunamazsa null
 */
export async function getTransaction(transactionId: string): Promise<Transaction | null> {
  try {
    const token = await getAuthTokenFromClient();
    if (!token) {
      throw new Error('Authentication failed: No valid token');
    }
    
    const response = await fetch(`/api/transactions/${transactionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch transaction');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching transaction:', error);
    throw error;
  }
}

/**
 * Yeni bir işlem oluşturur
 * @param transaction ID içermeyen işlem nesnesi - Oluşturulacak işlemin özellikleri (ID otomatik oluşturulur)
 * @returns Oluşturulan işlem ID'si - Oluşturulan işlemin benzersiz kimliği
 */
export async function createTransaction(transaction: Omit<Transaction, 'id'>): Promise<string> {
  try {
    const token = await getAuthTokenFromClient();
    if (!token) {
      throw new Error('Authentication failed: No valid token');
    }
    
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transaction)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create transaction');
    }
    
    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
}

/**
 * Mevcut bir işlemi günceller
 * @param transactionId İşlem ID'si - Güncellenecek işlemin benzersiz kimliği
 * @param transaction Güncellenecek işlem alanları - Kısmi güncelleme desteklenir, sadece değiştirilmek istenen alanlar gönderilir
 */
export async function updateTransaction(
  transactionId: string,
  transaction: Partial<Omit<Transaction, 'id'>>
): Promise<void> {
  try {
    const token = await getAuthTokenFromClient();
    if (!token) {
      throw new Error('Authentication failed: No valid token');
    }
    
    const response = await fetch(`/api/transactions/${transactionId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transaction)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update transaction');
    }
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw error;
  }
}

/**
 * Bir işlemi siler
 * @param transactionId Silinecek işlem ID'si - Silinecek işlemin benzersiz kimliği
 */
export async function deleteTransaction(transactionId: string): Promise<void> {
  try {
    const token = await getAuthTokenFromClient();
    if (!token) {
      throw new Error('Authentication failed: No valid token');
    }
    
    const response = await fetch(`/api/transactions/${transactionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete transaction');
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }
}

/**
 * Toplu işlem oluşturma (CSV/Excel yüklemesi için)
 * @param transactions İşlem listesi - Topluca eklenecek işlemler dizisi
 * @returns Eklenen işlem sayısı - Başarıyla eklenen işlemlerin toplam sayısı
 * 
 * Not: Bu fonksiyon, kullanıcıların CSV veya Excel dosyalarından içe aktardıkları
 * işlemleri toplu olarak sisteme eklemek için kullanılır.
 */
export async function createBatchTransactions(transactions: Omit<Transaction, 'id'>[]): Promise<number> {
  try {
    const token = await getAuthTokenFromClient();
    if (!token) {
      throw new Error('Authentication failed: No valid token');
    }
    
    const response = await fetch('/api/transactions/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transactions })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create batch transactions');
    }
    
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('Error creating batch transactions:', error);
    throw error;
  }
} 