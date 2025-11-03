import * as THREE from 'three'
import * as prettier from 'prettier'
import babelParser from 'prettier/parser-babel.js'
import isVarName from './isVarName.js'

function parse(gltf, { fileName = 'model', ...options } = {}) {
  if (gltf.isObject3D) {
    // Wrap scene in a GLTF Structure
    gltf = { scene: gltf, animations: [], parser: { json: {} } }
  }

  const url = (fileName.toLowerCase().startsWith('http') ? '' : '/') + fileName
  const animations = gltf.animations
  const hasAnimations = animations.length > 0

  // Collect all objects
  const objects = []
  gltf.scene.traverse((child) => objects.push(child))

  // Browse for duplicates
  const duplicates = {
    names: {},
    materials: {},
    geometries: {},
  }

  function uniqueName(attempt, index = 0) {
    const newAttempt = index > 0 ? attempt + index : attempt
    if (Object.values(duplicates.geometries).find(({ name }) => name === newAttempt) === undefined) return newAttempt
    else return uniqueName(attempt, index + 1)
  }

  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      if (child.material) {
        if (!duplicates.materials[child.material.name]) {
          duplicates.materials[child.material.name] = 1
        } else {
          duplicates.materials[child.material.name]++
        }
      }
    }
  })

  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) {
        const key = child.geometry.uuid + child.material?.name ?? ''
        if (!duplicates.geometries[key]) {
          let name = (child.name || 'Part').replace(/[^a-zA-Z]/g, '')
          name = name.charAt(0).toUpperCase() + name.slice(1)
          duplicates.geometries[key] = {
            count: 1,
            name: uniqueName(name),
            node: 'nodes' + sanitizeName(child.name),
          }
        } else {
          duplicates.geometries[key].count++
        }
      }
    }
  })

  // Prune duplicate geometries
  if (!options.instanceall) {
    for (let key of Object.keys(duplicates.geometries)) {
      const duplicate = duplicates.geometries[key]
      if (duplicate.count === 1) delete duplicates.geometries[key]
    }
  }

  const hasInstances = (options.instance || options.instanceall) && Object.keys(duplicates.geometries).length > 0

  function sanitizeName(name) {
    return isVarName(name) ? `.${name}` : `['${name}']`
  }

  const rNbr = (number) => {
    return parseFloat(number.toFixed(Math.round(options.precision || 2)))
  }

  const rDeg = (number) => {
    const abs = Math.abs(Math.round(parseFloat(number) * 100000))
    for (let i = 1; i <= 10; i++) {
      if (abs === Math.round(parseFloat(Math.PI / i) * 100000))
        return `${number < 0 ? '-' : ''}Math.PI${i > 1 ? ' / ' + i : ''}`
    }
    for (let i = 1; i <= 10; i++) {
      if (abs === Math.round(parseFloat(Math.PI * i) * 100000))
        return `${number < 0 ? '-' : ''}Math.PI${i > 1 ? ' * ' + i : ''}`
    }
    return rNbr(number)
  }

  function printTypes(objects, animations) {
    let meshes = objects.filter((o) => o.isMesh && o.__removed === undefined)
    let bones = objects.filter((o) => o.isBone && !(o.parent && o.parent.isBone) && o.__removed === undefined)
    let materials = [...new Set(objects.filter((o) => o.material && o.material.name).map((o) => o.material))]

    let animationTypes = ''
    if (animations.length) {
      animationTypes = `\n
  type ActionName = ${animations.map((clip, i) => `"${clip.name}"`).join(' | ')};

  interface GLTFAction extends THREE.AnimationClip { name: ActionName }\n`
    }

    const types = [...new Set([...meshes, ...bones].map((o) => getType(o)))]
    const contextType = hasInstances
      ? `\ntype ContextType = Record<string, React.ForwardRefExoticComponent<
     ${types.map((type) => `JSX.IntrinsicElements['${type}']`).join(' | ')}
    >>\n`
      : ''

    return `\n${animationTypes}\ntype GLTFResult = GLTF & {
    nodes: {
      ${meshes.map(({ name, type }) => (isVarName(name) ? name : `['${name}']`) + ': THREE.' + type).join(',')}
      ${bones.map(({ name, type }) => (isVarName(name) ? name : `['${name}']`) + ': THREE.' + type).join(',')}
    }
    materials: {
      ${materials.map(({ name, type }) => (isVarName(name) ? name : `['${name}']`) + ': THREE.' + type).join(',')}
    }
    animations: GLTFAction[]
  }\n${contextType}`
  }

  function getType(obj) {
    let type = obj.type.charAt(0).toLowerCase() + obj.type.slice(1)
    // Turn object3d's into groups, it should be faster according to the threejs docs
    if (type === 'object3D') type = 'group'
    if (type === 'perspectiveCamera') type = 'TresPerspectiveCamera'
    if (type === 'orthographicCamera') type = 'TresOrthographicCamera'
    return type
  }

  function getTresType(type) {
    // Convert to TresJS component name
    return 'Tres' + type.charAt(0).toUpperCase() + type.slice(1)
  }

  function handleProps(obj) {
    let { type, node, instanced } = getInfo(obj)

    let result = ''
    let isCamera = type === 'TresPerspectiveCamera' || type === 'TresOrthographicCamera'
    // Handle cameras
    if (isCamera) {
      result += `:make-default="false" `
      if (obj.zoom !== 1) result += `:zoom="${rNbr(obj.zoom)}" `
      if (obj.far !== 2000) result += `:far="${rNbr(obj.far)}" `
      if (obj.near !== 0.1) result += `:near="${rNbr(obj.near)}" `
    }
    if (type === 'TresPerspectiveCamera') {
      if (obj.fov !== 50) result += `:fov="${rNbr(obj.fov)}" `
    }

    if (!instanced) {
      // Shadows
      if (type === 'mesh' && options.shadows) result += `cast-shadow receive-shadow `

      // Write out geometry first
      if (obj.geometry && !obj.isInstancedMesh) {
        result += `:geometry="nodes${sanitizeName(obj.name)}.geometry" `
      }

      // Write out materials
      if (obj.material && !obj.isInstancedMesh) {
        if (obj.material.name) result += `:material="materials${sanitizeName(obj.material.name)}" `
        else result += `:material="nodes${sanitizeName(obj.name)}.material" `
      }

      if (obj.instanceMatrix) result += `:instance-matrix="nodes${sanitizeName(obj.name)}.instanceMatrix" `
      if (obj.instanceColor) result += `:instance-color="nodes${sanitizeName(obj.name)}.instanceColor" `
      if (obj.skeleton) result += `:skeleton="nodes${sanitizeName(obj.name)}.skeleton" `
      if (obj.visible === false) result += `:visible="false" `
      if (obj.castShadow === true) result += `cast-shadow `
      if (obj.receiveShadow === true) result += `receive-shadow `
      if (obj.morphTargetDictionary) result += `:morph-target-dictionary="nodes${sanitizeName(obj.name)}.morphTargetDictionary" `
      if (obj.morphTargetInfluences) result += `:morph-target-influences="nodes${sanitizeName(obj.name)}.morphTargetInfluences" `
      if (obj.intensity && rNbr(obj.intensity)) result += `:intensity="${rNbr(obj.intensity)}" `
      //if (obj.power && obj.power !== 4 * Math.PI) result += `:power="${rNbr(obj.power)}" `
      if (obj.angle && obj.angle !== Math.PI / 3) result += `:angle="${rDeg(obj.angle)}" `
      if (obj.penumbra && rNbr(obj.penumbra) !== 0) result += `:penumbra="${rNbr(obj.penumbra)}" `
      if (obj.decay && rNbr(obj.decay) !== 1) result += `:decay="${rNbr(obj.decay)}" `
      if (obj.distance && rNbr(obj.distance) !== 0) result += `:distance="${rNbr(obj.distance)}" `
      if (obj.up && obj.up.isVector3 && !obj.up.equals(new THREE.Vector3(0, 1, 0)))
        result += `:up="[${rNbr(obj.up.x)}, ${rNbr(obj.up.y)}, ${rNbr(obj.up.z)}]" `
    }

    if (obj.color && obj.color.getHexString() !== 'ffffff') result += `color="#${obj.color.getHexString()}" `
    if (obj.position && obj.position.isVector3 && rNbr(obj.position.length()))
      result += `:position="[${rNbr(obj.position.x)}, ${rNbr(obj.position.y)}, ${rNbr(obj.position.z)}]" `
    if (
      obj.rotation &&
      obj.rotation.isEuler &&
      rNbr(new THREE.Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z).length())
    )
      result += `:rotation="[${rDeg(obj.rotation.x)}, ${rDeg(obj.rotation.y)}, ${rDeg(obj.rotation.z)}]" `
    if (
      obj.scale &&
      obj.scale.isVector3 &&
      !(rNbr(obj.scale.x) === 1 && rNbr(obj.scale.y) === 1 && rNbr(obj.scale.z) === 1)
    ) {
      const rX = rNbr(obj.scale.x)
      const rY = rNbr(obj.scale.y)
      const rZ = rNbr(obj.scale.z)
      if (rX === rY && rX === rZ) {
        result += `:scale="${rX}" `
      } else {
        result += `:scale="[${rX}, ${rY}, ${rZ}]" `
      }
    }
    if (options.meta && obj.userData && Object.keys(obj.userData).length)
      result += `:user-data='${JSON.stringify(obj.userData)}' `

    return result
  }

  function getInfo(obj) {
    let type = getType(obj)
    let node = 'nodes' + sanitizeName(obj.name)
    let instanced =
      (options.instance || options.instanceall) &&
      obj.geometry &&
      obj.material &&
      duplicates.geometries[obj.geometry.uuid + obj.material.name] &&
      duplicates.geometries[obj.geometry.uuid + obj.material.name].count > (options.instanceall ? 0 : 1)
    let animated = gltf.animations && gltf.animations.length > 0
    return { type, node, instanced, animated }
  }

  function equalOrNegated(a, b) {
    return (a.x === b.x || a.x === -b.x) && (a.y === b.y || a.y === -b.y) && (a.z === b.z || a.z === -b.z)
  }

  function prune(obj, children, result, oldResult, silent) {
    let { type, animated } = getInfo(obj)
    // Prune ...
    if (!obj.__removed && !options.keepgroups && !animated && (type === 'group' || type === 'scene')) {
      /** Empty or no-property groups
       *    <group>
       *      <mesh geometry={nodes.foo} material={materials.bar} />
       *  Solution:
       *    <mesh geometry={nodes.foo} material={materials.bar} />
       */
      if (result === oldResult || obj.children.length === 0) {
        if (options.debug && !silent) console.log(`group ${obj.name} removed (empty)`)
        obj.__removed = true
        return children
      }

      // More aggressive removal strategies ...
      const first = obj.children[0]
      const firstProps = handleProps(first)
      const regex = /([a-z-A-Z]*)={([a-zA-Z0-9\.\[\]\-\,\ \/]*)}/g
      const keys1 = [...result.matchAll(regex)].map(([, match]) => match)
      const values1 = [...result.matchAll(regex)].map(([, , match]) => match)
      const keys2 = [...firstProps.matchAll(regex)].map(([, match]) => match)

      /** Double negative rotations
       *    <group rotation={[-Math.PI / 2, 0, 0]}>
       *      <group rotation={[Math.PI / 2, 0, 0]}>
       *        <mesh geometry={nodes.foo} material={materials.bar} />
       *  Solution:
       *    <mesh geometry={nodes.foo} material={materials.bar} />
       */
      if (obj.children.length === 1 && getType(first) === type && equalOrNegated(obj.rotation, first.rotation)) {
        if (keys1.length === 1 && keys2.length === 1 && keys1[0] === 'rotation' && keys2[0] === 'rotation') {
          if (options.debug && !silent) console.log(`group ${obj.name} removed (aggressive: double negative rotation)`)
          obj.__removed = first.__removed = true
          children = ''
          if (first.children) first.children.forEach((child) => (children += print(child, true)))
          return children
        }
      }

      /** Double negative rotations w/ props
       *    <group rotation={[-Math.PI / 2, 0, 0]}>
       *      <group rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
       *        <mesh geometry={nodes.foo} material={materials.bar} />
       *  Solution:
       *    <group scale={0.01}>
       *      <mesh geometry={nodes.foo} material={materials.bar} />
       */
      if (obj.children.length === 1 && getType(first) === type && equalOrNegated(obj.rotation, first.rotation)) {
        if (keys1.length === 1 && keys2.length > 1 && keys1[0] === 'rotation' && keys2.includes('rotation')) {
          if (options.debug && !silent)
            console.log(`group ${obj.name} removed (aggressive: double negative rotation w/ props)`)
          obj.__removed = true
          // Remove rotation from first child
          first.rotation.set(0, 0, 0)
          children = print(first, true)
          return children
        }
      }

      /** Transform overlap
       *    <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
       *      <mesh geometry={nodes.foo} material={materials.bar} />
       *  Solution:
       *    <mesh geometry={nodes.foo} material={materials.bar} position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]} />
       */
      const isChildTransformed = keys2.includes('position') || keys2.includes('rotation') || keys2.includes('scale')
      const hasOtherProps = keys1.some((key) => !['position', 'scale', 'rotation'].includes(key))
      if (obj.children.length === 1 && !first.__removed && !isChildTransformed && !hasOtherProps) {
        if (options.debug && !silent) console.log(`group ${obj.name} removed (aggressive: ${keys1.join(' ')} overlap)`)
        // Move props over from the to-be-deleted object to the child
        // This ensures that the child will have the correct transform when pruning is being repeated
        keys1.forEach((key) => obj.children[0][key].copy(obj[key]))
        // Insert the props into the result string
        children = print(first, true)
        obj.__removed = true
        return children
      }

      /** Lack of content
       *    <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
       *      <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
       *        <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]} />
       * Solution:
       *   (delete the whole sub graph)
       */
      const empty = []
      obj.traverse((o) => {
        const type = getType(o)
        if (type !== 'group' && type !== 'object3D') empty.push(o)
      })
      if (!empty.length) {
        if (options.debug && !silent) console.log(`group ${obj.name} removed (aggressive: lack of content)`)
        empty.forEach((child) => (child.__removed = true))
        return ''
      }
    }
  }

  function print(obj, silent = false) {
    let result = ''
    let children = ''
    let { type, node, instanced, animated } = getInfo(obj)

    // Check if the root node is useless
    if (obj.__removed && obj.children.length) {
      obj.children.forEach((child) => (result += print(child)))
      return result
    }

    // Get TresJS component name
    const tresType = getTresType(type)

    // Bail out on bones
    if (!options.bones && type === 'bone') {
      return `<TresPrimitive :object="nodes${sanitizeName(obj.name)}" />`
    }

    // Take care of lights with targets
    if (type.endsWith('Light') && obj.target && obj.children[0] === obj.target) {
      const tresLightType = getTresType(type)
      return `<${tresLightType} ${handleProps(obj)} :target="nodes${sanitizeName(obj.name)}.target">
        <TresPrimitive :object="nodes${sanitizeName(obj.name)}.target" ${handleProps(obj.target)} />
      </${tresLightType}>`
    }

    // Collect children
    if (obj.children) obj.children.forEach((child) => (children += print(child)))

    if (instanced) {
      result = `<instances.${duplicates.geometries[obj.geometry.uuid + obj.material.name].name} `
      type = `instances.${duplicates.geometries[obj.geometry.uuid + obj.material.name].name}`
    } else {
      if (obj.isInstancedMesh) {
        const geo = `nodes${sanitizeName(obj.name)}.geometry`
        const mat = obj.material.name ? `materials${sanitizeName(obj.material.name)}` : `nodes${sanitizeName(obj.name)}.material`
        type = "TresInstancedMesh"
        result = `<TresInstancedMesh :args="[${geo}, ${mat}, ${!obj.count ? `nodes${sanitizeName(obj.name)}.count` : obj.count}]" `
      } else {
        // Form the component in Vue template syntax
        if (type === 'bone') result = `<TresPrimitive :object="nodes${sanitizeName(obj.name)}" `
        else result = `<${tresType} `
      }
    }

    // Include names when output is uncompressed or morphTargetDictionaries are present
    if (obj.name.length && (options.keepnames || obj.morphTargetDictionary || animated)) result += `name="${obj.name}" `

    const oldResult = result
    result += handleProps(obj)

    const pruned = prune(obj, children, result, oldResult, silent)
    // Bail out if the object was pruned
    if (pruned !== undefined) return pruned

    // Close tag
    result += `${children.length ? '>' : '/>'}\n`

    // Add children and return
    if (children.length) {
      if (type === 'bone') result += children + `</TresPrimitive>`
      else result += children + `</${tresType}>`
    }
    return result
  }

  function printAnimations(animations) {
    return animations.length ? `\nconst { actions } = useAnimations(animations, group)` : ''
  }

  function parseExtras(extras) {
    if (extras) {
      return (
        Object.keys(extras)
          .map((key) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${extras[key]}`)
          .join('\n') + '\n'
      )
    } else return ''
  }

  function p(obj, line) {
    console.log(
      [...new Array(line * 2)].map(() => ' ').join(''),
      obj.type,
      obj.name,
      'pos:',
      obj.position.toArray().map(rNbr),
      'scale:',
      obj.scale.toArray().map(rNbr),
      'rot:',
      [obj.rotation.x, obj.rotation.y, obj.rotation.z].map(rNbr),
      'mat:',
      obj.material ? `${obj.material.name}-${obj.material.uuid.substring(0, 8)}` : ''
    )
    obj.children.forEach((o) => p(o, line + 1))
  }

  if (options.debug) p(gltf.scene, 0)

  // Flatten hierarchy: bake parent transforms into children
  // This prevents nested rotation groups from causing orientation issues
  if (!options.keepgroups) {
    objects.forEach((o) => {
      if (o.isMesh) {
        // Apply world matrix to get final position/rotation/scale
        o.updateWorldMatrix(true, false)
        const worldPos = new THREE.Vector3()
        const worldQuat = new THREE.Quaternion()
        const worldScale = new THREE.Vector3()
        o.matrixWorld.decompose(worldPos, worldQuat, worldScale)

        // Apply to the mesh
        o.position.copy(worldPos)
        o.quaternion.copy(worldQuat)
        o.scale.copy(worldScale)

        // Move mesh to scene root
        if (o.parent !== gltf.scene) {
          gltf.scene.add(o)
        }
      }
    })
  }

  let scene
  try {
    if (!options.keepgroups) {
      // Dry run to prune graph
      print(gltf.scene)
      // Move children of deleted objects to their new parents
      objects.forEach((o) => {
        if (o.__removed) {
          let parent = o.parent
          // Making sure we don't add to a removed parent
          while (parent && parent.__removed) parent = parent.parent
          // If no parent was found it must be the root node
          if (!parent) parent = gltf.scene
          o.children.slice().forEach((child) => parent.add(child))
        }
      })
      // Remove deleted objects
      objects.forEach((o) => {
        if (o.__removed && o.parent) o.parent.remove(o)
      })
    }
    // 2nd pass to eliminate hard to swat left-overs
    scene = print(gltf.scene)
  } catch (e) {
    console.log('Error while parsing glTF', e)
  }
  const header = `/*
${options.header ? options.header : 'Auto-generated by: https://github.com/OmnomnomTee/gltfvue'} ${
    options.size ? `\nFiles: ${options.size}` : ''
  }
${parseExtras(gltf.parser.json.asset && gltf.parser.json.asset.extras)}*/`
  const hasPrimitives = scene.includes('<TresPrimitive')

  // Check for unlit materials with emissive textures
  const gltfJson = gltf.parser?.json
  const hasUnlitMaterials = gltfJson?.extensionsUsed?.includes('KHR_materials_unlit')
  let materialFixCode = ''

  if (hasUnlitMaterials && gltfJson?.materials) {
    const needsTextureLoader = gltfJson.materials.some(mat =>
      mat.extensions?.KHR_materials_unlit && mat.emissiveTexture
    )

    if (needsTextureLoader) {
      materialFixCode = `\n// Fix unlit materials: Apply emissive textures to base color for proper display
import { TextureLoader } from 'three'
const textureLoader = new TextureLoader()

`
      gltfJson.materials.forEach(mat => {
        if (mat.extensions?.KHR_materials_unlit) {
          const matName = mat.name

          // Check if material has baseColorTexture - if so, just fix the color
          const hasBaseColor = mat.pbrMetallicRoughness?.baseColorTexture !== undefined

          if (hasBaseColor) {
            // Material already has a baseColor texture loaded, just set color to white
            materialFixCode += `materials${sanitizeName(matName)}.color.setRGB(1, 1, 1)\n`
          } else if (mat.emissiveTexture !== undefined && gltfJson.images) {
            // Material only has emissive texture, need to load it manually
            materialFixCode += `materials${sanitizeName(matName)}.color.setRGB(1, 1, 1)\n`
            const texIndex = mat.emissiveTexture.index
            const imageIndex = gltfJson.textures?.[texIndex]?.source
            if (imageIndex !== undefined && gltfJson.images[imageIndex]) {
              const imagePath = gltfJson.images[imageIndex].uri
              if (imagePath) {
                const dir = url.substring(0, url.lastIndexOf('/') + 1)
                materialFixCode += `const ${matName.replace(/[^a-zA-Z0-9]/g, '_')}_map = textureLoader.load('${dir}${imagePath}')\n`
                materialFixCode += `${matName.replace(/[^a-zA-Z0-9]/g, '_')}_map.flipY = false\n`
                materialFixCode += `materials${sanitizeName(matName)}.map = ${matName.replace(/[^a-zA-Z0-9]/g, '_')}_map\n`
              }
            }
          }
        }
      })

      materialFixCode += `\n// Mark materials as needing update
Object.values(materials).forEach(mat => mat.needsUpdate = true)\n`
    }
  }

  // Vue SFC format
  const result = `<script setup lang="ts">
import { useGLTF } from '@tresjs/cientos'${hasAnimations ? `\nimport { useAnimations } from '@tresjs/cientos'` : ''}

const { nodes, materials${hasAnimations ? ', animations' : ''} } = await useGLTF('${url}')
${materialFixCode}${hasAnimations ? `const { actions } = useAnimations(animations)` : ''}
</script>

<template>
  <TresGroup>
${scene}
  </TresGroup>
</template>`

  if (!options.console) console.log(header)
  const output = header + '\n' + result

  // For Vue SFC, don't use Prettier for now - just return the output
  // TODO: Add proper Vue formatter support
  return output
}

export default parse
