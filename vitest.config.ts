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
    // Les tests d'intégration partagent la même base PostgreSQL locale : en
    // parallèle ils se perturbent (suppressions, verrous Serializable).
    fileParallelism: false,
  },
})
