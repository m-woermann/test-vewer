# Astro Three.js Viewer

A 3D viewer application built with Astro and Three.js.

## Features

- Interactive 3D scene with OrbitControls
- Shadow casting and receiving
- Responsive design
- TypeScript support
- Proper asset handling

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Preview production build:
```bash
npm run preview
```

## Project Structure

- `src/components/ThreeViewer.astro`: Main Three.js viewer component
- `src/layouts/Layout.astro`: Base layout with proper styling
- `src/pages/index.astro`: Main page
- `public/`: Static assets
- `astro.config.mjs`: Astro configuration with Three.js setup
- `tsconfig.json`: TypeScript configuration

## Development

The viewer is set up with a sample rotating cube. To add your own 3D models:

1. Place your model files in the `public` directory
2. Import and load them in `ThreeViewer.astro`
3. Update the scene setup as needed

## Technologies Used

- Astro
- Three.js
- TypeScript