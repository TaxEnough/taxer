import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Servis hesabı kimlik bilgilerini yapılandır
interface ServiceAccount {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

let serviceAccount: ServiceAccount;

try {
  // İlk olarak tam JSON string'i kontrol et
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    console.log('Firebase Admin: Tam servis hesabı JSON kullanılıyor');
  } 
  // Eğer tam JSON yoksa, ayrı çevre değişkenlerini kullan
  else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    serviceAccount = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // \n karakterlerini gerçek satır sonu karakterleriyle değiştir
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
    console.log('Firebase Admin: Ayrı çevre değişkenleri kullanılıyor');
  }
  // Hiçbir kimlik bilgisi bulunamazsa uyar
  else {
    console.warn('Firebase Admin: Servis hesabı kimlik bilgileri eksik!');
    serviceAccount = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'missing-project-id',
      clientEmail: 'missing@example.com',
      privateKey: 'missing-private-key',
    };
  }
} catch (error) {
  console.error('Firebase Admin: Servis hesabı ayarlanırken hata:', error);
  throw new Error('Firebase Admin SDK yapılandırma hatası');
}

// Firebase Admin SDK'yı yalnızca bir kez başlat
let adminApp;
let db: Firestore;

try {
  const apps = getApps();
  
  // Uygulama zaten başlatılmışsa, tekrar başlatma
  if (apps.length === 0) {
    console.log('Firebase Admin: SDK başlatılıyor');
    adminApp = initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
    });
  } else {
    console.log('Firebase Admin: Mevcut uygulama kullanılıyor');
    adminApp = apps[0];
  }
  
  // Sadece Firestore referansını al
  db = getFirestore(adminApp);
  
  console.log('Firebase Admin: Başarıyla yapılandırıldı (sadece Firestore)');
} catch (error) {
  console.error('Firebase Admin: SDK başlatılırken hata:', error);
  throw new Error('Firebase Admin SDK başlatma hatası');
}

export { db, adminApp }; 