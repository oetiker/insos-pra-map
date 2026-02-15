import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'child_process';

const commitDate = execSync('git log -1 --format=%cI').toString().trim();
const buildDate = new Date().toISOString();

export default defineConfig({
  plugins: [tailwindcss()],
  root: 'src',
  base: '/insos-pra-map/',
  define: {
    __COMMIT_DATE__: JSON.stringify(commitDate),
    __BUILD_DATE__: JSON.stringify(buildDate)
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
});
