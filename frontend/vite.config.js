import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/modules/talent'),
      'next/navigation': path.resolve(__dirname, './src/modules/talent/shims/next-navigation.tsx'),
      'next/link': path.resolve(__dirname, './src/modules/talent/shims/next-link.tsx'),
      'next/font/google': path.resolve(__dirname, './src/modules/talent/shims/next-font.ts'),
      'next/cache': path.resolve(__dirname, './src/modules/talent/shims/next-cache.ts'),
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
