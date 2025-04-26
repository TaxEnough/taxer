'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { auth, deleteUserAccount } from '@/lib/auth-firebase';
import { signInWithEmailAndPassword, signOut, User as FirebaseUser } from 'firebase/auth';

export default function DeleteAccountForm() {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(auth.currentUser);
  
  const { user, logout } = useAuth();
  const router = useRouter();
  
  // Firebase kullanıcı oturumunu kontrol et
  useEffect(() => {
    const checkFirebaseAuth = () => {
      const currentUser = auth.currentUser;
      setFirebaseUser(currentUser);
      console.log("Firebase oturum durumu:", currentUser ? "Açık" : "Kapalı");
    };
    
    checkFirebaseAuth();
    
    // Firebase oturum değişikliklerini dinle
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setFirebaseUser(user);
      console.log("Firebase oturum değişikliği:", user ? "Oturum açıldı" : "Oturum kapatıldı");
    });
    
    return () => unsubscribe();
  }, []);
  
  // Silme onayını göster
  const handleOpenConfirmation = () => {
    if (!user) {
      setError("Session is not active. You need to be logged in to delete your account.");
      router.push('/login');
      return;
    }
    
    // Firebase'de oturum açık mı kontrol et
    if (!firebaseUser) {
      setError("Firebase session is not active. You need to log in again to delete your account.");
      // Eğer context'de kullanıcı bilgisi varsa, firebase'e giriş yapmayı dene
      if (user && user.email) {
        setError("You need to enter your password to verify your session.");
        setShowConfirmation(true);
        return;
      } else {
        router.push('/login');
        return;
      }
    }
    
    setError(null);
    setShowConfirmation(true);
  };

  // Kullanıcıyı giriş yaptır
  const handleLogin = async () => {
    if (!user || !user.email) {
      setError("User information not found. Please log in again.");
      router.push('/login');
      return;
    }
    
    try {
      setIsDeleting(true);
      setError(null);
      
      // Firebase'de oturum aç
      await signInWithEmailAndPassword(auth, user.email, password);
      setFirebaseUser(auth.currentUser);
      setSuccess("Authentication successful! Now you can delete your account.");
      
      // 2 saniye sonra başarı mesajını temizle
      setTimeout(() => {
        setSuccess(null);
      }, 2000);
      
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "An error occurred during login.";
      
      // Firebase hata kodlarını kontrol et
      if (error.code === 'auth/wrong-password') {
        errorMessage = "Wrong password. Please try again.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed login attempts. Please try again later.";
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = "User not found. Please try a different email address.";
      }
      
      setError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Hesabı sil
  const handleDeleteAccount = async () => {
    if (!user) {
      setError("Session is not active. You need to be logged in to delete your account.");
      router.push('/login');
      return;
    }
    
    // Firebase oturumu kontrol et
    if (!firebaseUser) {
      // Önce Firebase'de oturum açmayı dene
      try {
        if (!password) {
          setError("You need to enter your password to delete your account.");
          return;
        }
        await handleLogin();
      } catch (error) {
        console.error("Firebase login error:", error);
        setError("You need to log in again to delete your account. Please enter your password.");
        return;
      }
    }
    
    if (!password) {
      setError("You need to enter your password to delete your account.");
      return;
    }
    
    try {
      setIsDeleting(true);
      setError(null);
      
      // Hesabı sil
      await deleteUserAccount(password);
      
      setSuccess("Your account has been successfully deleted. You are being redirected to the home page...");
      
      // Çıkış yap ve ana sayfaya yönlendir
      await logout();
      
      // 2 saniye bekle ve ana sayfaya yönlendir
      setTimeout(() => {
        router.push('/');
      }, 2000);
      
    } catch (error: any) {
      console.error("Account deletion error:", error);
      
      // Hata mesajlarını kontrol et
      let errorMessage = "An error occurred while deleting the account.";
      
      if (error.message) {
        if (error.message.includes("wrong-password")) {
          errorMessage = "Wrong password. Please try again.";
        } else if (error.message.includes("requires-recent-login")) {
          errorMessage = "For security reasons, you need to log in again. Please log out and log in again.";
          // Oturumu kapat
          signOut(auth).then(() => {
            setTimeout(() => {
              router.push('/login');
            }, 2000);
          });
        } else if (error.message.includes("too-many-requests")) {
          errorMessage = "Too many failed attempts. Please try again later.";
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // İptal et
  const handleCancel = () => {
    setShowConfirmation(false);
    setPassword('');
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
      <h3 className="text-lg font-semibold text-red-600 mb-4">Account Management</h3>
      
      {!showConfirmation ? (
        <div>
          <p className="text-gray-700 mb-4">
            Deleting your account will permanently remove all your data and this action cannot be undone.
          </p>
          <button
            type="button"
            onClick={handleOpenConfirmation}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Delete My Account
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-red-100 p-3 rounded-md border border-red-300">
            <h4 className="font-bold text-red-800 mb-2">Warning: This action cannot be undone!</h4>
            <p className="text-gray-800">
              When you delete your account, all your data will be permanently deleted. Enter your password to confirm this action.
            </p>
          </div>
          
          {!firebaseUser && user && (
            <div className="bg-yellow-100 p-3 rounded-md border border-yellow-300">
              <p className="text-yellow-800">
                For security reasons, you need to verify your Firebase session to delete your account. Please enter your password.
              </p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-100 p-3 rounded-md border border-red-300">
              <p className="text-red-800">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="bg-green-100 p-3 rounded-md border border-green-300">
              <p className="text-green-800">{success}</p>
            </div>
          )}
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Your Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
              placeholder="Enter your password"
              disabled={isDeleting}
            />
          </div>
          
          <div className="flex space-x-3">
            {!firebaseUser && user ? (
              <button
                type="button"
                onClick={handleLogin}
                disabled={isDeleting || !password}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Processing..." : "Verify Identity"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting || !password}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting Account..." : "Delete My Account"}
              </button>
            )}
            
            <button
              type="button"
              onClick={handleCancel}
              disabled={isDeleting}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 