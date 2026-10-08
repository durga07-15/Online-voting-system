import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' lets the built site work on GitHub Pages under any repo name
export default defineConfig({
  plugins: [react()],
  base: './',
});
