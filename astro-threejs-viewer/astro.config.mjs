import { defineConfig } from 'astro/config';

export default defineConfig({
  vite: {
    ssr: {
      noExternal: ['three']
    },
    resolve: {
      alias: {
        'three/examples/jsm/loaders/GLTFLoader': 'three/examples/jsm/loaders/GLTFLoader.js',
        'three/examples/jsm/loaders/DRACOLoader': 'three/examples/jsm/loaders/DRACOLoader.js',
        'three/examples/jsm/controls/OrbitControls': 'three/examples/jsm/controls/OrbitControls.js'
      }
    },
    optimizeDeps: {
      include: ['three']
    },
    build: {
      assetsInlineLimit: 0 // Don't inline assets
    }
  }
});