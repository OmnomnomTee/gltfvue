<script setup>
import { TresCanvas } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import SceneModel from './components/Model.vue'
</script>

<template>
  <div class="demo-container">
    <div class="header">
      <h1>GLTFVue Demo</h1>
      <p>GLTF to TresJS Component Viewer</p>
    </div>

    <TresCanvas clear-color="#1a1a2e">
      <!-- Lights -->
      <TresAmbientLight :intensity="1.5" />
      <TresDirectionalLight :position="[10, 10, 5]" :intensity="2" cast-shadow />
      <TresDirectionalLight :position="[-10, 5, -5]" :intensity="1.5" />
      <TresDirectionalLight :position="[0, -5, 0]" :intensity="1" />
      <TresPointLight :position="[0, 5, 0]" :intensity="2" />

      <!-- Camera Controls -->
      <OrbitControls />

      <!-- Load the generated Scene component -->
      <Suspense>
        <SceneModel />
      </Suspense>
    </TresCanvas>

    <div class="info">
      <p>🎮 Use mouse to orbit • Scroll to zoom</p>
      <p>✨ Generated with GLTFVue</p>
    </div>
  </div>
</template>

<style scoped>
.demo-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.header {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.6);
  padding: 20px 30px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.header h1 {
  font-size: 2em;
  margin: 0;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header p {
  margin: 5px 0 0;
  opacity: 0.8;
  font-size: 0.9em;
}

.info {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  background: rgba(0, 0, 0, 0.6);
  padding: 15px 25px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
  text-align: center;
}

.info p {
  margin: 5px 0;
  font-size: 0.85em;
  opacity: 0.9;
}
</style>