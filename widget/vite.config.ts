import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'ZureConfigurator',
      fileName: 'configurator',
      formats: ['iife'],
    },
    outDir: resolve(__dirname, '../extensions/configurator-widget/assets'),
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: 'configurator.js',
        assetFileNames: 'configurator.[ext]',
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
