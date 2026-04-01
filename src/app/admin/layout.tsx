'use client';

import { AppProvider, Frame, Navigation } from '@shopify/polaris';
import {
  HomeIcon,
  ProductIcon,
  SettingsIcon,
  OrderIcon,
  ImportIcon,
  ClockIcon,
} from '@shopify/polaris-icons';
import { usePathname } from 'next/navigation';
import enTranslations from '@shopify/polaris/locales/en.json';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navigation = (
    <Navigation location={pathname}>
      <Navigation.Section
        items={[
          {
            url: '/admin/product-families',
            label: 'Product Families',
            icon: ProductIcon,
            selected: pathname.startsWith('/admin/product-families'),
          },
          {
            url: '/admin/components',
            label: 'Components',
            icon: SettingsIcon,
            selected: pathname === '/admin/components',
          },
          {
            url: '/admin/orders',
            label: 'Order Configs',
            icon: OrderIcon,
            selected: pathname === '/admin/orders',
          },
          {
            url: '/admin/import-export',
            label: 'Import / Export',
            icon: ImportIcon,
            selected: pathname === '/admin/import-export',
          },
          {
            url: '/admin/audit-log',
            label: 'Audit Log',
            icon: ClockIcon,
            selected: pathname === '/admin/audit-log',
          },
        ]}
      />
    </Navigation>
  );

  return (
    <AppProvider i18n={enTranslations}>
      <Frame navigation={navigation}>
        {children}
      </Frame>
    </AppProvider>
  );
}
