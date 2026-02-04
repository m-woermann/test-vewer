import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [],
  // Enable client-side scripts
  output: 'hybrid',
  vite: {
    // Configure Vite for handling Three.js imports
    ssr: {
      noExternal: ['three']
    }
  }
});