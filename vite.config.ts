import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022', sourcemap: false },
  // The Vite dev server (used for the dev-only stress projects) forwards the API to the local Pages dev server.
  server: { proxy: { '/api': 'http://127.0.0.1:8788' } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/functions/**/*.test.ts'],
    css: false,
  },
});
