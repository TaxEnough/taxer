'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui/toast';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AuthProvider>
  );
} 