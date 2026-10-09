import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// Standard Localhost Vite Configuration (Zero Base44 Telemetry)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    open: true
  }
});
