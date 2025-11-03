# GLTFVue Demo App

This is a demo Vue.js application that showcases the GLTF to TresJS component transformation.

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
# or
yarn install
```

### Run Development Server

```bash
npm run dev
# or
yarn dev
```

Then open your browser to `http://localhost:3000`

### Build for Production

```bash
npm run build
# or
yarn build
```

## 📁 Project Structure

```
demo/
├── src/
│   ├── components/
│   │   └── Scene.vue          # Generated TresJS component
│   ├── App.vue                # Main app with TresCanvas
│   └── main.js                # App entry point
├── public/
│   └── scene.gltf             # GLTF model and assets
├── index.html
├── package.json
└── vite.config.js
```

## 🎮 Controls

- **Orbit**: Click and drag with left mouse button
- **Zoom**: Scroll wheel
- **Pan**: Click and drag with right mouse button
- **Debug Panel**: Click the 📊 icon in the top-right corner

## 📊 Debug Panel

The demo includes an interactive debug panel that shows:

- **Geometry Stats**: Mesh count, vertices, triangles
- **Materials**: List of all materials used
- **Bounding Box**: Model dimensions and bounds
- **File Size**: GLTF file size
- **Optimization Tips**: Warnings for high poly counts or too many materials

This helps you understand your model's complexity and identify optimization opportunities.

## 🔧 How It Works

1. The `Scene.vue` component is auto-generated from a GLTF file using GLTFVue
2. It uses TresJS components (`<TresMesh>`, `<TresGroup>`, etc.)
3. The `useGLTF` composable from `@tresjs/cientos` loads the 3D model
4. The component is embedded in `App.vue` inside a `<TresCanvas>`
5. OrbitControls from TresJS provide camera interaction

## 🔄 Regenerating the Scene Component

To regenerate the Scene component from a different GLTF file:

```bash
# From the root directory
node cli.js path/to/your-model.gltf --output demo/src/components/Scene.vue

# For complex models with transformations, use --keepgroups
node cli.js path/to/your-model.gltf --output demo/src/components/Scene.vue --keepgroups

# For production: optimize with Draco compression and transformations
node cli.js path/to/your-model.gltf --output demo/src/components/Scene.vue --keepgroups --transform

# Copy your GLTF assets to demo/public/
cp path/to/your-model.gltf demo/public/
# Or the transformed version
mv demo/src/components/*-transformed.glb demo/public/
```

### Optimization Flags

- **`--keepgroups`**: Preserves nested transformations (scale, position, rotation on parent groups). Without it, the parser optimizes by removing "unnecessary" groups, which may flatten important hierarchical transformations.

- **`--transform`**: Applies web optimizations including:
  - **Draco compression** for geometry (smaller file size)
  - **Texture optimization** (WebP format, resized)
  - **Mesh joining** (combines compatible meshes for better performance)
  - **Material deduplication** (reduces draw calls)

  ⚠️ Note: Transform may merge separate parts into single meshes. Great for static models, but not ideal if you need to animate individual parts.

### Current Demo

This demo uses `--transform` with Draco compression:
- Original: 16.7KB GLTF (+ separate textures)
- Optimized: 1.13MB GLB (all-in-one with Draco compression)
- Result: Single optimized mesh with baked transformations

## 📚 Learn More

- [TresJS Documentation](https://tresjs.org/)
- [Vue.js Documentation](https://vuejs.org/)
- [Three.js Documentation](https://threejs.org/)
- [GLTFVue GitHub](https://github.com/OmnomnomTee/gltfvue)