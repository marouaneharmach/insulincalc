import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/insulincalc/',
  test: {
    exclude: ['node_modules/**', '.claude/**', 'v4/**', 'worker/**'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'app.html'),
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})
