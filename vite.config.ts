import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages is served from a custom domain (ciallo.de), so base is root.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    // Two HTML entries so each locale gets its own crawlable URL with its own
    // <html lang>, canonical and og block. One shared JS bundle: the locale is
    // derived from the path at runtime (src/i18n.ts), never from a stored preference.
    // Paths are root-relative on purpose — `node:url`/`node:path` would typecheck only
    // while @types/node happens to be hoisted, and it is not a declared dependency.
    rollupOptions: {
      input: { en: 'index.html', zh: 'zh/index.html' },
    },
  },
});
