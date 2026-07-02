'use client';

export default function AuthRequired() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center',
      padding: '40px 20px', color: '#333',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
        Session expired
      </h1>
      <p style={{ fontSize: '15px', color: '#666', maxWidth: '400px', lineHeight: 1.5, marginBottom: '24px' }}>
        Please open the Zure Configurator from your Shopify admin to continue.
      </p>
      <p style={{ fontSize: '13px', color: '#999' }}>
        Shopify Admin → Apps → Zure Configurator
      </p>
    </div>
  );
}
