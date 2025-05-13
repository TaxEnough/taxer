'use client';

import React, { ReactNode } from 'react';
import PremiumGuard from '@/components/PremiumGuard';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <PremiumGuard featureName="dashboard">
      {children}
    </PremiumGuard>
  );
} 