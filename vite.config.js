import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// GitHub Pages is served from a custom domain (ciallo.de), so base is root.
export default defineConfig({
    plugins: [react()],
    base: '/',
});
