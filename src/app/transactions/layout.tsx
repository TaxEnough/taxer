'use client';

import React, { ReactNode } from 'react';
import PremiumGuard from '@/components/PremiumGuard';

export default function TransactionsLayout({ children }: { children: ReactNode }) {
  return (
    <PremiumGuard featureName="transactions">
      {children}
    </PremiumGuard>
  );
} 