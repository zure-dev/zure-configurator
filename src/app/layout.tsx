import type {Metadata} from 'next';
import '@shopify/polaris/build/esm/styles.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Zure Configurator',
  description: 'Product configuration platform for Shopify',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}