'use client';

import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

export const DashboardLayout = ({ children, title }: DashboardLayoutProps) => {
  return (
    <div className="flex-1 overflow-auto p-4 lg:p-6 bg-background h-full w-full">
      <div className="animate-fade-in w-full">
        {children}
      </div>
    </div>
  );
};
