import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

type VitestUserConfig = UserConfig & {
  test: {
    environment: string
    globals: boolean
    setupFiles: string[]
    exclude: string[]
    coverage: {
      provider: 'v8'
      reporter: string[]
      include: string[]
      all: boolean
      thresholds: {
        statements: number
        branches: number
        functions: number
        lines: number
      }
    }
  }
}

// https://vite.dev/config/
const config: VitestUserConfig = {
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts', 'src/store/**/*.ts'],
      all: true,
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
}

export default defineConfig(config)
