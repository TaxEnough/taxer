// Firebase sadece blog içeriklerinin saklanması için kullanılacak
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase yapılandırması
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Firebase uygulamasını başlat (sadece blog işlemleri için)
const app = initializeApp(firebaseConfig);

// Firestore veritabanı referansı (sadece blog içerikleri için)
const db = getFirestore(app);

// Sadece Firestore'u dışa aktar - Auth ve Analytics yok
export { db }; 