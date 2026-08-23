import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js'

const FXAAShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1 / 1024, 1 / 512) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    varying vec2 vUv;

    #define FXAA_REDUCE_MIN   (1.0/ 128.0)
    #define FXAA_REDUCE_MUL   (1.0 / 8.0)
    #define FXAA_SPAN_MAX     8.0

    void main() {
      vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-resolution.x, -resolution.y)).rgb;
      vec3 rgbNE = texture2D(tDiffuse, vUv + vec2(resolution.x, -resolution.y)).rgb;
      vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-resolution.x, resolution.y)).rgb;
      vec3 rgbSE = texture2D(tDiffuse, vUv + vec2(resolution.x, resolution.y)).rgb;
      vec3 rgbM  = texture2D(tDiffuse, vUv).rgb;

      vec3 luma = vec3(0.299, 0.587, 0.114);
      float lumaNW = dot(rgbNW, luma);
      float lumaNE = dot(rgbNE, luma);
      float lumaSW = dot(rgbSW, luma);
      float lumaSE = dot(rgbSE, luma);
      float lumaM  = dot(rgbM,  luma);

      float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
      float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

      vec2 dir;
      dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
      dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

      float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);

      float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
      dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX), dir * rcpDirMin)) * resolution;

      vec3 rgbA = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 rgbB = rgbA * 0.5 + 0.5 * (texture2D(tDiffuse, vUv + dir * (0.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (3.0 / 3.0 - 0.5)).rgb);

      float lumaB = dot(rgbB, luma);
      if ((lumaB < lumaMin) || (lumaB > lumaMax)) {
        gl_FragColor = vec4(rgbA, 1.0);
      } else {
        gl_FragColor = vec4(rgbB, 1.0);
      }
    }
  `,
}

export class PostProcessing {
  private composer!: EffectComposer
  private bloomPass!: UnrealBloomPass
  private ssaoPass!: SSAOPass
  private outputPass!: OutputPass
  private fxaaPass!: ShaderPass
  private filmPass!: FilmPass

  private enabled = {
    bloom: true,
    ssao: true,
    fxaa: true,
    film: false,
  }

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera
  ) {
    this.init()
  }

  private init(): void {
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))

    // SSAO - Screen Space Ambient Occlusion
    this.ssaoPass = new SSAOPass(this.scene, this.camera, window.innerWidth, window.innerHeight)
    this.ssaoPass.kernelRadius = 8
    this.ssaoPass.minDistance = 0.005
    this.ssaoPass.maxDistance = 0.1
    this.ssaoPass.output = SSAOPass.OUTPUT.Default
    this.composer.addPass(this.ssaoPass)

    // Bloom for emissive materials and bright highlights
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.6,   // strength
      0.4,   // radius
      0.85   // threshold
    )
    this.composer.addPass(this.bloomPass)

    // FXAA for anti-aliasing
    this.fxaaPass = new ShaderPass(FXAAShader)
    this.fxaaPass.material.uniforms.resolution.value.x = 1 / window.innerWidth
    this.fxaaPass.material.uniforms.resolution.value.y = 1 / window.innerHeight
    this.composer.addPass(this.fxaaPass)

    // Film grain (subtle) - FilmPass in newer three.js takes (intensity, grayscale)
    this.filmPass = new FilmPass(0.35, false)
    this.composer.addPass(this.filmPass)

    // Output pass with tone mapping
    this.outputPass = new OutputPass()
    this.composer.addPass(this.outputPass)
  }

  render(delta: number): void {
    this.composer.render(delta)
  }

  onResize(width: number, height: number): void {
    this.composer.setSize(width, height)
    this.ssaoPass.setSize(width, height)
    this.bloomPass.setSize(width, height)
    this.fxaaPass.material.uniforms.resolution.value.x = 1 / width
    this.fxaaPass.material.uniforms.resolution.value.y = 1 / height
  }

  setBloomEnabled(enabled: boolean): void {
    this.enabled.bloom = enabled
    this.bloomPass.enabled = enabled
  }

  setSSAOEnabled(enabled: boolean): void {
    this.enabled.ssao = enabled
    this.ssaoPass.enabled = enabled
  }

  setFXAAEnabled(enabled: boolean): void {
    this.enabled.fxaa = enabled
    this.fxaaPass.enabled = enabled
  }

  setFilmEnabled(enabled: boolean): void {
    this.enabled.film = enabled
    this.filmPass.enabled = enabled
  }

  setBloomStrength(strength: number): void {
    this.bloomPass.strength = strength
  }

  setBloomThreshold(threshold: number): void {
    this.bloomPass.threshold = threshold
  }

  setBloomRadius(radius: number): void {
    this.bloomPass.radius = radius
  }

  setSSAOKernelRadius(radius: number): void {
    this.ssaoPass.kernelRadius = radius
  }

  setSSAOMinDistance(dist: number): void {
    this.ssaoPass.minDistance = dist
  }

  setSSAOMaxDistance(dist: number): void {
    this.ssaoPass.maxDistance = dist
  }

  getComposer(): EffectComposer {
    return this.composer
  }
}