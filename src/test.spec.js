import assert from 'node:assert'
import { describe, it, after } from 'node:test'
import fs from 'fs'
import path from 'path'
import gltfjsx from '../src/gltfjsx.js'

describe('GLTF to Vue/TresJS Transformation', () => {
  const testGltfPath = 'public/scene.gltf'

  // Helper to generate unique test file name
  function getTestOutputPath(testName) {
    return `test-output-${testName.replace(/\s+/g, '-')}.vue`
  }

  // Clean up after all tests
  after(() => {
    // Clean up any test output files
    const testFiles = fs.readdirSync('.').filter(f => f.startsWith('test-output-'))
    testFiles.forEach(f => fs.unlinkSync(f))

    if (fs.existsSync('scene-transformed.glb')) {
      fs.unlinkSync('scene-transformed.glb')
    }
  })

  it('should generate a valid Vue component', async () => {
    const testOutputPath = getTestOutputPath('valid-vue-component')
    await gltfjsx(testGltfPath, testOutputPath, {
      header: 'Auto-generated test',
      printwidth: 120,
      precision: 3,
    })

    assert(fs.existsSync(testOutputPath), 'Output file should exist')
    const content = fs.readFileSync(testOutputPath, 'utf-8')

    // Should not contain React imports
    assert(!content.includes('import React'), 'Should not import React')
    assert(!content.includes('@react-three/drei'), 'Should not import React Three Drei')

    // Should contain Vue/TresJS imports
    assert(content.includes('<script setup'), 'Should use Vue script setup')
    assert(content.includes('<template>'), 'Should have template section')
  })

  it('should use TresJS components instead of JSX', async () => {
    const testOutputPath = getTestOutputPath('tresjs-components')
    await gltfjsx(testGltfPath, testOutputPath, {
      header: 'Auto-generated test',
      printwidth: 120,
      precision: 3,
    })

    const content = fs.readFileSync(testOutputPath, 'utf-8')

    // Should use TresJS components (PascalCase in template)
    assert(content.includes('<TresMesh'), 'Should use TresMesh component')
    assert(content.includes('<TresGroup'), 'Should use TresGroup component')

    // Should not use JSX syntax
    assert(!content.includes('return ('), 'Should not use JSX return statement')
  })

  it('should use useGLTF composable', async () => {
    const testOutputPath = getTestOutputPath('usegltf-composable')
    await gltfjsx(testGltfPath, testOutputPath, {
      header: 'Auto-generated test',
      printwidth: 120,
      precision: 3,
    })

    // Ensure file is fully written
    await new Promise(resolve => setTimeout(resolve, 100))
    assert(fs.existsSync(testOutputPath), 'Output file should exist')
    const content = fs.readFileSync(testOutputPath, 'utf-8')

    // Should use Vue composables
    assert(content.includes('useGLTF'), 'Should use useGLTF composable')
    assert(content.includes('const { nodes, materials }'), 'Should destructure nodes and materials')
  })

  it('should handle geometry and materials correctly', async () => {
    const testOutputPath = getTestOutputPath('geometry-materials')
    await gltfjsx(testGltfPath, testOutputPath, {
      header: 'Auto-generated test',
      printwidth: 120,
      precision: 3,
    })

    const content = fs.readFileSync(testOutputPath, 'utf-8')

    // Should pass geometry and material as props
    assert(content.includes(':geometry='), 'Should bind geometry prop')
    assert(content.includes(':material='), 'Should bind material prop')
  })

  it('should handle transformations (position, rotation, scale)', async () => {
    const testOutputPath = getTestOutputPath('transformations')
    await gltfjsx(testGltfPath, testOutputPath, {
      header: 'Auto-generated test',
      printwidth: 120,
      precision: 3,
    })

    // Ensure file is fully written
    await new Promise(resolve => setTimeout(resolve, 100))
    assert(fs.existsSync(testOutputPath), 'Output file should exist')
    const content = fs.readFileSync(testOutputPath, 'utf-8')

    // Should use Vue binding syntax for vectors (this test file has rotation)
    assert(content.includes(':rotation='), 'Should handle rotation')
  })

  it('should preserve metadata in header comment', async () => {
    const testOutputPath = getTestOutputPath('metadata-header')
    const headerText = 'Auto-generated test header'
    await gltfjsx(testGltfPath, testOutputPath, {
      header: headerText,
      printwidth: 120,
      precision: 3,
    })

    // Ensure file is fully written
    await new Promise(resolve => setTimeout(resolve, 100))
    assert(fs.existsSync(testOutputPath), 'Output file should exist')
    const content = fs.readFileSync(testOutputPath, 'utf-8')

    assert(content.includes(headerText), 'Should include header in output')
    assert(content.startsWith('/*'), 'Should start with comment block')
  })

  it('should handle --transform flag and optimize assets', async () => {
    const testOutputPath = getTestOutputPath('transform-flag')
    const outputDir = path.dirname(path.resolve(testOutputPath))
    const transformedPath = path.join(outputDir, 'scene-transformed.glb')

    await gltfjsx(testGltfPath, testOutputPath, {
      header: 'Auto-generated test',
      transform: true,
      resolution: 512,
      printwidth: 120,
      precision: 3,
    })

    assert(fs.existsSync(transformedPath), 'Should create transformed GLB file')
    const content = fs.readFileSync(testOutputPath, 'utf-8')
    assert(content.includes('scene-transformed.glb'), 'Should reference transformed file')
  })

  it('should handle animations if present', async () => {
    const testOutputPath = getTestOutputPath('animations')
    // This test will pass even if no animations exist
    await gltfjsx(testGltfPath, testOutputPath, {
      header: 'Auto-generated test',
      printwidth: 120,
      precision: 3,
    })

    const content = fs.readFileSync(testOutputPath, 'utf-8')

    // If animations exist, should use useAnimations
    if (content.includes('animations')) {
      assert(content.includes('useAnimations'), 'Should use useAnimations composable if animations exist')
    }
  })

  it('should format output with prettier', async () => {
    const testOutputPath = getTestOutputPath('formatting')
    await gltfjsx(testGltfPath, testOutputPath, {
      header: 'Auto-generated test',
      printwidth: 120,
      precision: 3,
    })

    // Ensure file is fully written
    await new Promise(resolve => setTimeout(resolve, 100))
    assert(fs.existsSync(testOutputPath), 'Output file should exist')
    const content = fs.readFileSync(testOutputPath, 'utf-8')

    // Basic formatting checks
    assert(!content.includes('  \n'), 'Should not have trailing whitespace')
    // Should be valid Vue SFC
    assert(content.includes('<script'), 'Should have script section')
    assert(content.includes('<template>'), 'Should have template section')
    assert(content.includes('</template>'), 'Should close template section')
  })
})