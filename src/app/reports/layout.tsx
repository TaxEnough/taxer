'use client';

import React, { ReactNode } from 'react';
import PremiumGuard from '@/components/PremiumGuard';

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <PremiumGuard featureName="reports">
      {children}
    </PremiumGuard>
  );
} 