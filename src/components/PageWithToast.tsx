'use client';

import React, { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';

interface PageWithToastProps {
  children: ReactNode;
}

export default function PageWithToast({ children }: PageWithToastProps) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
} 