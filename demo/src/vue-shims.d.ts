declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    TresGroup: typeof import('@tresjs/core')['TresGroup']
    TresMesh: typeof import('@tresjs/core')['TresMesh']
    TresAmbientLight: typeof import('@tresjs/core')['TresAmbientLight']
    TresDirectionalLight: typeof import('@tresjs/core')['TresDirectionalLight']
    TresPerspectiveCamera: typeof import('@tresjs/core')['TresPerspectiveCamera']
    TresOrthographicCamera: typeof import('@tresjs/core')['TresOrthographicCamera']
    TresPrimitive: typeof import('@tresjs/core')['TresPrimitive']
    TresInstancedMesh: typeof import('@tresjs/core')['TresInstancedMesh']
    TresCanvas: typeof import('@tresjs/core')['TresCanvas']
  }
}

export {}