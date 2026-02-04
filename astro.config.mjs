import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [],
  vite: {
    build: {
      assetsInlineLimit: 0, // Don't inline assets
    },
    ssr: {
      noExternal: ['three'],
    },
    resolve: {
      alias: {
        'three/examples/jsm/loaders/GLTFLoader': 'three/examples/jsm/loaders/GLTFLoader.js',
        'three/examples/jsm/loaders/DRACOLoader': 'three/examples/jsm/loaders/DRACOLoader.js'
      }
    },
    optimizeDeps: {
      include: ['three']
    }
  }
});