import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  // Saat `npm run dev`, teruskan /api ke backend Express
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
