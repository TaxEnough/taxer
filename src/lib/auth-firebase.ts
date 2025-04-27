import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  UserCredential,
  User,
  sendPasswordResetEmail,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateProfile,
  updatePassword,
  sendEmailVerification,
  updateEmail as updateFirebaseEmail,
  updatePassword as updateFirebasePassword
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  updateDoc,
  deleteDoc,
  getFirestore
} from 'firebase/firestore';
import { auth as firebaseAuth } from './firebase';
import jwt from 'jsonwebtoken';
// Firebase Admin SDK'yı kaldırıyoruz, client tarafında kullanılmamalı
// import { auth as adminAuth } from './firebase-admin';

// Auth referansını bir fonksiyon olarak dışa aktar
export function getAuth() {
  return firebaseAuth;
}

// Auth referansını doğrudan kullanmak için
const auth = firebaseAuth;

// Firestore referansı
const db = getFirestore();

// E-posta formatı doğrulama
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// JWT token için özel interface
interface DecodedToken {
  uid?: string;
  sub?: string;
  user_id?: string;
  userId?: string;
  firebase?: {
    identities?: {
      [key: string]: string[];
    };
  };
  [key: string]: any;
}

/**
 * Firebase kimlik doğrulama token'ını doğrular
 * Bu fonksiyon istemci tarafından kullanılacak,
 * sunucu tarafı doğrulama için auth-server.ts dosyasındaki verifyTokenServer kullanılmalıdır.
 * 
 * @param token Firebase kimlik doğrulama token'ı
 * @returns Doğrulanmış token bilgisi veya null
 */
export const verifyToken = async (token: string): Promise<DecodedToken | null> => {
  try {
    // JWT token'ı decode et
    const decoded = jwt.decode(token) as DecodedToken | null;
    
    if (!decoded) {
      console.error('Token decode edilemedi');
      return null;
    }
    
    // UID kontrolü - token'ın içeriğindeki farklı alanlarda uid olabilir
    if (!decoded.uid) {
      // sub alanını kontrol et (JWT standardı)
      if (decoded.sub) {
        decoded.uid = decoded.sub;
      }
      // user_id alanını kontrol et (Firebase'in kullandığı bir alan)
      else if (decoded.user_id) {
        decoded.uid = decoded.user_id;
      }
      // Firebase identities içinde bakabilir
      else if (decoded.firebase && decoded.firebase.identities && decoded.firebase.identities['firebase.com']) {
        decoded.uid = decoded.firebase.identities['firebase.com'][0];
      }
      // userId alanını kontrol et (özel bir alan)
      else if (decoded.userId) {
        decoded.uid = decoded.userId;
      }
    }
    
    return decoded;
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    return null;
  }
};

// Kullanıcı kaydı
export const registerUser = async (
  name: string,
  email: string, 
  password: string
): Promise<User> => {
  try {
    // E-posta formatı kontrolü
    if (!validateEmail(email)) {
      throw new Error('Invalid email format. Please enter a valid email address.');
    }
    
    // E-posta içinde boşluk karakteri kontrolü
    if (email.includes(' ')) {
      email = email.trim(); // Boşlukları temizle
      console.log('E-posta boşluklar temizlendi:', email);
    }
    
    console.log('Firebase ile kullanıcı kaydı yapılıyor:', email);
    const auth = getAuth();
    
    // Firebase Authentication ile kullanıcı oluştur
    const userCredential: UserCredential = await createUserWithEmailAndPassword(
      auth, 
      email, 
      password
    );
    
    console.log('Firebase kullanıcısı oluşturuldu, Firestore kaydı yapılıyor');
    
    // Kullanıcı bilgilerini Firestore'a kaydet
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email,
      name,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
    
    console.log('Firestore kaydı tamamlandı');
    
    // Kullanıcı profil bilgilerini güncelle
    await updateProfile(userCredential.user, {
      displayName: name
    });
    
    return userCredential.user;
  } catch (error: any) {
    console.error('Kayıt hatası detayları:', {
      code: error.code,
      message: error.message,
      customData: error.customData
    });
    
    // Firebase hata koduna göre özel mesajlar
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email address is already in use. Please login or use a different email address.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email format. Please enter a valid email address.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Weak password. Your password must be at least 6 characters long.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    
    throw new Error(error.message || 'An error occurred during registration');
  }
};

// Kullanıcı girişi
export const loginUser = async (
  email: string, 
  password: string
): Promise<User> => {
  try {
    // E-posta içinde boşluk karakteri kontrolü
    if (email.includes(' ')) {
      email = email.trim(); // Boşlukları temizle
      console.log('E-posta boşluklar temizlendi:', email);
    }
    const auth = getAuth();
    
    const userCredential: UserCredential = await signInWithEmailAndPassword(
      auth, 
      email, 
      password
    );
    
    // Son giriş zamanını güncelle
    await setDoc(
      doc(db, 'users', userCredential.user.uid), 
      { lastLogin: serverTimestamp() },
      { merge: true }
    );
    
    return userCredential.user;
  } catch (error: any) {
    console.error('Giriş hatası detayları:', {
      code: error.code,
      message: error.message
    });
    
    // Firebase hata koduna göre özel mesajlar
    if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email format.');
    } else if (error.code === 'auth/user-not-found') {
      throw new Error('No user found with this email address.');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many failed login attempts. Please try again later.');
    }
    
    throw new Error(error.message || 'An error occurred during login');
  }
};

// Şifre sıfırlama e-postası gönder
export const sendResetPasswordEmail = async (email: string): Promise<void> => {
  try {
    // E-posta formatı kontrolü
    if (!validateEmail(email)) {
      throw new Error('Invalid email format. Please enter a valid email address.');
    }
    
    // E-posta içindeki boşlukları temizle
    if (email.includes(' ')) {
      email = email.trim();
      console.log('Email spaces cleaned:', email);
    }
    
    console.log('Sending password reset email:', email);
    const auth = getAuth();
    
    // Firebase şifre sıfırlama e-postası gönder
    // ActionCodeSettings parametresi opsiyonel olarak eklenebilir
    await sendPasswordResetEmail(auth, email);
    
    console.log('Şifre sıfırlama e-postası başarıyla gönderildi');
    return;
  } catch (error: any) {
    console.error('Şifre sıfırlama e-postası gönderilirken hata:', error);
    
    // Firebase hata kodları kontrolü
    if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email format.');
    } else if (error.code === 'auth/user-not-found') {
      throw new Error('No user found with this email address.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many requests sent. Please try again later.');
    }
    
    throw new Error(error.message || 'An error occurred while sending the password reset email');
  }
};

// Kullanıcı çıkışı
export const logoutUser = async (): Promise<void> => {
  try {
    const auth = getAuth();
    await signOut(auth);
  } catch (error: any) {
    console.error('Logout error:', error);
    throw new Error(error.message || 'An error occurred during logout');
  }
};

// Kullanıcı bilgilerini getir
export const getUserData = async (userId: string) => {
  try {
    // userId kontrolü
    if (!userId) {
      console.error('getUserData: userId parameter is empty or undefined');
      return null;
    }
    
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return null;
  } catch (error: any) {
    console.error('User data error:', error);
    // Return null in case of error, don't propagate the error
    // This allows the API to continue working and use token information
    return null;
  }
};

// Kullanıcı profilini güncelle
export async function updateUserProfile(userId: string, data: { name?: string }) {
  try {
    const userRef = doc(db, 'users', userId);
    
    // Önce kullanıcı dökümanını kontrol edelim
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.error('User not found:', userId);
      return null;
    }
    
    // Kullanıcı bilgilerini güncelle
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    
    // Eğer isim güncellemesi varsa, Firebase Auth profilini de güncelle
    if (data.name) {
      const auth = getAuth();
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: data.name
        });
        console.log('Firebase Auth profile updated');
      }
    }
    
    return true;
  } catch (error: any) {
    console.error('Profile update error:', error.message);
    // Return null instead of throwing an error
    return null;
  }
}

// Kullanıcı şifresini güncelle
export async function updateUserPassword(oldPassword: string, newPassword: string) {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user || !user.email) {
      throw new Error('No logged in user found.');
    }
    
    // Kullanıcıyı yeniden kimlik doğrulaması yap
    const credential = EmailAuthProvider.credential(user.email, oldPassword);
    await reauthenticateWithCredential(user, credential);
    
    // Şifreyi güncelle
    await updatePassword(user, newPassword);
    console.log('Kullanıcı şifresi güncellendi.');
    
    return true;
  } catch (error: any) {
    console.error('Şifre güncelleme hatası:', error);
    
    // Hata kodlarını daha anlaşılır hale getir
    if (error.code === 'auth/wrong-password') {
      throw new Error('Your current password is incorrect.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('New password is too weak. It must be at least 6 characters long.');
    } else if (error.code === 'auth/requires-recent-login') {
      throw new Error('For security reasons, you need to log in again.');
    }
    
    throw error;
  }
}

// Kullanıcı hesabını sil
export async function deleteUserAccount(password: string) {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user || !user.email) {
      const errorMessage = 'No logged in user found. You need to be logged in to delete your account.';
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    console.log('Starting account deletion process:', user.email);
    
    try {
      // Kullanıcıyı yeniden kimlik doğrulaması yap
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      console.log('Re-authentication successful.');
      
      // Önce kullanıcı verilerini Firestore'dan sil
      try {
        await deleteDoc(doc(db, 'users', user.uid));
        console.log('User data deleted from Firestore.');
      } catch (firestoreError) {
        console.error('Error deleting user data from Firestore:', firestoreError);
        // Continue with user account deletion even if database error occurs
      }
      
      // Firebase Authentication'dan kullanıcıyı sil
      await deleteUser(user);
      console.log('User deleted from Firebase Authentication.');
      
      return true;
    } catch (authError: any) {
      // Auth error codes already translated
      throw authError;
    }
  } catch (error) {
    console.error('Error during account deletion process:', error);
    throw error;
  }
}

// Firebase kullanıcı profilini doğrudan güncelle (client-side işlem)
export async function updateFirebaseProfile(user: User, displayName: string) {
  try {
    await updateProfile(user, { displayName });
    return true;
  } catch (error) {
    console.error('Firebase profil güncelleme hatası:', error);
    throw error;
  }
} 