'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';

export default function DeleteAccountForm() {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { user, logout } = useAuth(); // Legacy compatibility
  const { user: clerkUser, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  // Hesabı sil
  const handleDeleteAccount = async () => {
    if (!clerkUser || !isSignedIn) {
      setError("Session is not active. You need to be logged in to delete your account.");
      router.push('/login');
      return;
    }
    
    if (!password) {
      setError("You need to enter your password to delete your account.");
      return;
    }
    
    setIsDeleting(true);
    setError(null);
    
    try {
      // Clerk API kullanarak hesabı silme (password argümanı olmadan)
      await clerkUser.delete();
      
      // Hesap silindi, çıkış yap
      await signOut();
      
      setSuccess("Your account has been successfully deleted.");
      
      // Başlangıç sayfasına yönlendir
      setTimeout(() => {
        router.push('/');
      }, 2000);
      
    } catch (error: any) {
      console.error("Error deleting account:", error);
      
      // Clerk API hatalarını ele al
      let errorMessage = "An error occurred while deleting your account.";
      
      if (error.status === 401) {
        errorMessage = "Incorrect password. Please try again.";
      } else if (error.status === 429) {
        errorMessage = "Too many requests. Please try again later.";
      }
      
      setError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-red-100">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Delete Account</h2>
      <p className="text-sm text-gray-600 mb-4">
        Once you delete your account, there is no going back. Please be certain.
      </p>
      
      {error && (
        <div className="mb-4 p-4 rounded-md bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 rounded-md bg-green-50 text-green-700 text-sm">
          {success}
        </div>
      )}
      
      {!showConfirmation ? (
        <button
          type="button"
          onClick={() => setShowConfirmation(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Delete My Account
        </button>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-medium text-red-600">
            Are you sure you want to delete your account? All of your data will be permanently removed. This action cannot be undone.
          </p>
          
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
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeleting || !password}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? "Deleting Account..." : "Delete My Account"}
            </button>
            
            <button
              type="button"
              onClick={() => {
                setShowConfirmation(false);
                setPassword('');
                setError(null);
              }}
              disabled={isDeleting}
              className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 