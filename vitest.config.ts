import path from 'node:path'
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config({ path: path.resolve(__dirname, '.env') })

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
  },
})
