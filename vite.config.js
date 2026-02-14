import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  root: 'src',
  base: '/insos-map/',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
});
