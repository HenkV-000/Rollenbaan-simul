import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Rollenbaan-simul/' : '/',
  plugins: [react()],
  base: '/Rollenbaan-simul/',
});
