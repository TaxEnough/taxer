import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useClerk } from '@clerk/nextjs';
import { AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';

export default function DeleteAccountButton() {
  const { user, logout } = useAuth();
  const { signOut } = useClerk();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Send request to API
      const response = await fetch('/api/user/delete-account', {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      // Is client-side action needed?
      if (response.status === 202 && data.shouldUseClientSide) {
        console.log('Performing client-side account deletion');
        
        try {
          // Sign out with Clerk
          await signOut();
          await logout();
          
        } catch (clerkError: any) {
          console.error('Clerk account deletion error:', clerkError);
          setError('Account deletion error: ' + (clerkError.message || 'Unknown error'));
        }
      } else if (response.ok) {
        // Successfully deleted on API side
        await signOut();
        await logout();
      } else {
        setError(data.error || 'Account could not be deleted');
      }
    } catch (error: any) {
      console.error('Account deletion error:', error);
      setError('An error occurred during the process');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 border-t border-gray-200 pt-8">
      <h3 className="text-lg font-medium text-red-600">Delete Account</h3>
      <p className="mt-2 text-sm text-gray-500">
        Deleting your account will permanently remove all your data. This action cannot be undone.
      </p>
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}
      
      {showConfirmation ? (
        <div className="mt-4 p-4 border border-red-200 rounded-md bg-red-50">
          <p className="font-medium text-red-700 mb-4">
            This action cannot be undone. Your account and all your data will be permanently deleted.
          </p>
          <div className="flex gap-4">
            <button
              onClick={handleDeleteAccount}
              disabled={loading}
              className={`px-4 py-2 text-white rounded-md ${
                loading 
                  ? 'bg-red-400 cursor-not-allowed' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? 'Processing...' : 'Delete My Account'}
            </button>
            <button
              onClick={() => setShowConfirmation(false)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirmation(true)}
          className="mt-4 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md"
        >
          Delete Account
        </button>
      )}
    </div>
  );
} 