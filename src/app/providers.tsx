'use client';

import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import type { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return <AppProvider i18n={{}}>{children}</AppProvider>;
}