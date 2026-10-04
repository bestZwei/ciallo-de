import { fileURLToPath } from 'node:url';
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
    rollupOptions: {
      input: {
        en: fileURLToPath(new URL('./index.html', import.meta.url)),
        zh: fileURLToPath(new URL('./zh/index.html', import.meta.url)),
      },
    },
  },
});
