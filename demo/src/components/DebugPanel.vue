<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  nodes: Object,
  materials: Object,
  modelUrl: String,
  originalSize: Number,
  transformedSize: Number,
})

const isOpen = ref(true)
const fileSize = ref(null)

// Calculate mesh statistics
const meshCount = computed(() => {
  if (!props.nodes) return 0
  return Object.values(props.nodes).filter(n => n.isMesh).length
})

const materialCount = computed(() => {
  if (!props.materials) return 0
  return Object.keys(props.materials).length
})

const vertexCount = computed(() => {
  if (!props.nodes) return 0
  return Object.values(props.nodes)
    .filter(n => n.geometry)
    .reduce((sum, n) => {
      const count = n.geometry.attributes?.position?.count || 0
      return sum + count
    }, 0)
})

const triangleCount = computed(() => {
  if (!props.nodes) return 0
  return Object.values(props.nodes)
    .filter(n => n.geometry)
    .reduce((sum, n) => {
      const indices = n.geometry.index
      const count = indices ? indices.count / 3 : 0
      return sum + count
    }, 0)
})

// Get bounding box
const boundingBox = computed(() => {
  if (!props.nodes) return null
  const allNodes = Object.values(props.nodes).filter(n => n.isMesh)
  if (allNodes.length === 0) return null

  // Calculate combined bounds
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  allNodes.forEach(node => {
    if (node.geometry && node.geometry.boundingBox) {
      const bb = node.geometry.boundingBox
      for (let i = 0; i < 3; i++) {
        bounds.min[i] = Math.min(bounds.min[i], bb.min.getComponent(i))
        bounds.max[i] = Math.max(bounds.max[i], bb.max.getComponent(i))
      }
    }
  })

  const size = [
    (bounds.max[0] - bounds.min[0]).toFixed(2),
    (bounds.max[1] - bounds.min[1]).toFixed(2),
    (bounds.max[2] - bounds.min[2]).toFixed(2),
  ]

  return { min: bounds.min.map(v => v.toFixed(2)), max: bounds.max.map(v => v.toFixed(2)), size }
})

onMounted(async () => {
  // Try to get file size
  if (props.modelUrl) {
    try {
      const response = await fetch(props.modelUrl, { method: 'HEAD' })
      const size = response.headers.get('content-length')
      if (size) {
        fileSize.value = formatBytes(parseInt(size))
      }
    } catch (e) {
      console.warn('Could not fetch file size:', e)
    }
  }
})

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function formatNumber(num) {
  return num.toLocaleString()
}

function formatSizeChange() {
  if (!props.originalSize || !props.transformedSize) return 'N/A'
  const reduction = props.originalSize - props.transformedSize
  const percentage = ((reduction / props.originalSize) * 100).toFixed(1)
  const sign = reduction > 0 ? '-' : '+'
  return `${sign}${Math.abs(percentage)}% (${formatBytes(Math.abs(reduction))})`
}

function getSizeChangeClass() {
  if (!props.originalSize || !props.transformedSize) return ''
  const reduction = props.originalSize - props.transformedSize
  if (reduction > 0) return 'size-reduced'
  if (reduction < 0) return 'size-increased'
  return ''
}
</script>

<template>
  <div class="debug-panel" :class="{ open: isOpen }">
    <button class="debug-toggle" @click="isOpen = !isOpen">
      {{ isOpen ? '✕' : '📊' }}
    </button>

    <transition name="slide">
      <div v-if="isOpen" class="debug-content">
        <h3>📊 Model Stats</h3>

        <div class="stat-section">
          <h4>Geometry</h4>
          <div class="stat-row">
            <span class="label">Meshes:</span>
            <span class="value">{{ meshCount }}</span>
          </div>
          <div class="stat-row">
            <span class="label">Vertices:</span>
            <span class="value">{{ formatNumber(vertexCount) }}</span>
          </div>
          <div class="stat-row">
            <span class="label">Triangles:</span>
            <span class="value">{{ formatNumber(Math.floor(triangleCount)) }}</span>
          </div>
        </div>

        <div class="stat-section">
          <h4>Materials</h4>
          <div class="stat-row">
            <span class="label">Count:</span>
            <span class="value">{{ materialCount }}</span>
          </div>
          <div v-if="materials" class="material-list">
            <div v-for="(mat, name) in materials" :key="name" class="material-item">
              • {{ name }}
            </div>
          </div>
        </div>

        <div v-if="boundingBox" class="stat-section">
          <h4>Bounding Box</h4>
          <div class="stat-row">
            <span class="label">Size:</span>
            <span class="value">{{ boundingBox.size.join(' × ') }}</span>
          </div>
          <div class="stat-row small">
            <span class="label">Min:</span>
            <span class="value">{{ boundingBox.min.join(', ') }}</span>
          </div>
          <div class="stat-row small">
            <span class="label">Max:</span>
            <span class="value">{{ boundingBox.max.join(', ') }}</span>
          </div>
        </div>

        <div v-if="originalSize || transformedSize || fileSize" class="stat-section">
          <h4>File Size Comparison</h4>
          <div v-if="originalSize" class="stat-row">
            <span class="label">Original (with textures):</span>
            <span class="value">{{ formatBytes(originalSize) }}</span>
          </div>
          <div v-if="transformedSize" class="stat-row">
            <span class="label">Transformed (Draco):</span>
            <span class="value">{{ formatBytes(transformedSize) }}</span>
          </div>
          <div v-if="originalSize && transformedSize" class="stat-row highlight">
            <span class="label">Size Reduction:</span>
            <span :class="['value', getSizeChangeClass()]">
              {{ formatSizeChange() }}
            </span>
          </div>
          <div v-if="fileSize && !transformedSize" class="stat-row">
            <span class="label">Size:</span>
            <span class="value">{{ fileSize }}</span>
          </div>
        </div>

        <div class="stat-section">
          <h4>Optimization Tips</h4>
          <div class="tip">
            <span v-if="triangleCount > 100000" class="warning">⚠️</span>
            <span v-else class="success">✓</span>
            High poly count ({{ formatNumber(Math.floor(triangleCount)) }} tris)
          </div>
          <div class="tip">
            <span v-if="materialCount > 5" class="warning">⚠️</span>
            <span v-else class="success">✓</span>
            {{ materialCount }} materials
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.debug-panel {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 100;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
}

.debug-toggle {
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.2);
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.debug-toggle:hover {
  background: rgba(0, 0, 0, 0.95);
  border-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.05);
}

.debug-content {
  position: absolute;
  top: 50px;
  right: 0;
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 16px;
  min-width: 280px;
  max-height: 70vh;
  overflow-y: auto;
  backdrop-filter: blur(20px);
}

.debug-content h3 {
  margin: 0 0 16px 0;
  color: #667eea;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
}

.stat-section {
  margin-bottom: 16px;
}

.stat-section h4 {
  margin: 0 0 8px 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 600;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  color: rgba(255, 255, 255, 0.9);
}

.stat-row.small {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.stat-row .label {
  color: rgba(255, 255, 255, 0.6);
}

.stat-row .value {
  color: #4ade80;
  font-weight: 600;
}

.material-list {
  margin-top: 8px;
  max-height: 120px;
  overflow-y: auto;
}

.material-item {
  padding: 2px 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
}

.tip {
  padding: 6px 8px;
  margin: 4px 0;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  gap: 8px;
}

.warning {
  color: #fbbf24;
}

.success {
  color: #4ade80;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Scrollbar styling */
.debug-content::-webkit-scrollbar,
.material-list::-webkit-scrollbar {
  width: 6px;
}

.debug-content::-webkit-scrollbar-track,
.material-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.debug-content::-webkit-scrollbar-thumb,
.material-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.debug-content::-webkit-scrollbar-thumb:hover,
.material-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* File size comparison styles */
.stat-row.highlight {
  background: rgba(102, 126, 234, 0.1);
  padding: 8px;
  margin: 4px -8px;
  border-radius: 4px;
  border-left: 3px solid #667eea;
}

.size-reduced {
  color: #4ade80 !important;
}

.size-increased {
  color: #ef4444 !important;
}
</style>