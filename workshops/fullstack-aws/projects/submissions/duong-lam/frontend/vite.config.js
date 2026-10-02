import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite = the dev server and build tool. port 5173 must match the CORS list in backend/main.py.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
