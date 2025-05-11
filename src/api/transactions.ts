import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, orderBy, DocumentData } from 'firebase/firestore';
import { Transaction } from '@/types/transaction';

/**
 * Kullanıcıya ait tüm işlemleri getirir
 * @param userId Kullanıcı ID'si - Firebase Authentication ile oluşturulan benzersiz kullanıcı kimliği
 * @returns İşlem listesi - Tarih sırasına göre sıralanmış kullanıcının tüm işlemleri
 */
export async function getUserTransactions(userId: string): Promise<Transaction[]> {
  try {
    const q = query(
      collection(db, `users/${userId}/transactions`),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const transactions: Transaction[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        ...data,
        date: data.date.toDate(),
      } as Transaction);
    });
    
    return transactions;
  } catch (error) {
    console.error('İşlemler getirilirken hata oluştu:', error);
    throw error;
  }
}

/**
 * Belirli bir kullanıcı işlemini ID'ye göre getirir
 * @param userId Kullanıcı ID'si - İşlemin sahibi olan kullanıcının kimliği
 * @param transactionId İşlem ID'si - Firestore'da oluşturulan benzersiz belge kimliği
 * @returns İşlem detayları - Bulunan işlem veya işlem bulunamazsa null
 */
export async function getTransaction(userId: string, transactionId: string): Promise<Transaction | null> {
  try {
    const docRef = doc(db, `users/${userId}/transactions/${transactionId}`);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        date: data.date.toDate(),
      } as Transaction;
    }
    
    return null;
  } catch (error) {
    console.error('İşlem getirilirken hata oluştu:', error);
    throw error;
  }
}

/**
 * Yeni bir işlem oluşturur
 * @param userId Kullanıcı ID'si - İşlemin sahibi olan kullanıcının kimliği
 * @param transaction ID içermeyen işlem nesnesi - Oluşturulacak işlemin özellikleri (ID otomatik oluşturulur)
 * @returns Oluşturulan işlem ID'si - Firestore tarafından oluşturulan benzersiz belge kimliği
 */
export async function createTransaction(userId: string, transaction: Omit<Transaction, 'id'>): Promise<string> {
  try {
    const collectionRef = collection(db, `users/${userId}/transactions`);
    const docRef = await addDoc(collectionRef, transaction);
    return docRef.id;
  } catch (error) {
    console.error('İşlem oluşturulurken hata oluştu:', error);
    throw error;
  }
}

/**
 * Mevcut bir işlemi günceller
 * @param userId Kullanıcı ID'si - İşlemin sahibi olan kullanıcının kimliği
 * @param transactionId İşlem ID'si - Güncellenecek işlemin benzersiz kimliği
 * @param transaction Güncellenecek işlem alanları - Kısmi güncelleme desteklenir, sadece değiştirilmek istenen alanlar gönderilir
 */
export async function updateTransaction(
  userId: string,
  transactionId: string,
  transaction: Partial<Omit<Transaction, 'id'>>
): Promise<void> {
  try {
    const docRef = doc(db, `users/${userId}/transactions/${transactionId}`);
    await updateDoc(docRef, transaction);
  } catch (error) {
    console.error('İşlem güncellenirken hata oluştu:', error);
    throw error;
  }
}

/**
 * Bir işlemi siler
 * @param userId Kullanıcı ID'si - İşlemin sahibi olan kullanıcının kimliği
 * @param transactionId Silinecek işlem ID'si - Silinecek işlemin benzersiz kimliği
 */
export async function deleteTransaction(userId: string, transactionId: string): Promise<void> {
  try {
    const docRef = doc(db, `users/${userId}/transactions/${transactionId}`);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('İşlem silinirken hata oluştu:', error);
    throw error;
  }
}

/**
 * Toplu işlem oluşturma (CSV/Excel yüklemesi için)
 * @param userId Kullanıcı ID'si - İşlemlerin sahibi olan kullanıcının kimliği
 * @param transactions İşlem listesi - Topluca eklenecek işlemler dizisi
 * @returns Eklenen işlem sayısı - Başarıyla eklenen işlemlerin toplam sayısı
 * 
 * Not: Bu fonksiyon, kullanıcıların CSV veya Excel dosyalarından içe aktardıkları
 * işlemleri toplu olarak sisteme eklemek için kullanılır. Her işlem ayrı bir belge
 * olarak Firestore'a kaydedilir.
 */
export async function createBatchTransactions(userId: string, transactions: Omit<Transaction, 'id'>[]): Promise<number> {
  try {
    let successCount = 0;
    const collectionRef = collection(db, `users/${userId}/transactions`);
    
    // Firestore toplu işlem limiti 500 olduğundan her işlemi ayrı ayrı ekleyelim
    for (const transaction of transactions) {
      await addDoc(collectionRef, transaction);
      successCount++;
    }
    
    return successCount;
  } catch (error) {
    console.error('Toplu işlem oluşturulurken hata oluştu:', error);
    throw error;
  }
} 