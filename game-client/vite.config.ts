import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Using PostCSS for Tailwind v4 integration
export default defineConfig({
  plugins: [react()],
})
