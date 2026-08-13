import {
  GLSL3,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';

export type ReactiveWebGLMode = 'tunnel' | 'particles' | 'kaleidoscope';

const vertexShader = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uLevel;
uniform float uBands[16];
uniform int uMode;
out vec4 outputColor;

#define PI 3.141592653589793

vec3 palette(float value) {
  return .55 + .45 * cos(6.28318 * (value + vec3(.02, .27, .57)));
}

float bandAt(float position) {
  float scaled = clamp(position, 0.0, .999) * 15.0;
  int lower = int(floor(scaled));
  int upper = min(15, lower + 1);
  return mix(uBands[lower], uBands[upper], fract(scaled));
}

float lineGlow(float distance, float width) {
  return width / max(width, abs(distance));
}

vec3 tunnel(vec2 uv) {
  float radius = length(uv);
  float angle = atan(uv.y, uv.x);
  float angularPosition = fract((angle + PI) / (2.0 * PI));
  float sectorPosition = angularPosition * 16.0;
  int sector = min(15, int(floor(sectorPosition)));
  float sectorPhase = fract(sectorPosition);
  float sectorEnergy = uBands[sector];
  float bass = (uBands[0] + uBands[1] + uBands[2]) / 3.0;
  float mids = (uBands[5] + uBands[6] + uBands[7] + uBands[8] + uBands[9]) / 5.0;
  float warpedRadius = radius * (1.0 - sectorEnergy * .13);
  warpedRadius += sin(angle * 16.0 - uTime * 1.4) * sectorEnergy * .018;
  float perspective = 1.0 / max(.075, warpedRadius);
  float depth = perspective + uTime * (1.0 + bass * 4.4 + mids * 1.2);

  float primaryRingDistance = abs(fract(depth * .205) - .5);
  float secondaryRingDistance = abs(fract(depth * .41 + sectorEnergy * .12) - .5);
  float rings = lineGlow(primaryRingDistance, .011 + sectorEnergy * .026);
  rings += lineGlow(secondaryRingDistance, .006 + sectorEnergy * .009) * .34;

  float spokeDistance = abs(sectorPhase - .5);
  float spokes = lineGlow(spokeDistance, .012 + sectorEnergy * .026);
  spokes *= smoothstep(.03, .3, radius) * (.08 + sectorEnergy * 1.55);
  float rails = pow(max(0.0, cos(sectorPhase * PI * 2.0)), 20.0) * (.04 + sectorEnergy * .5);

  float hue = fract(angularPosition + depth * .028 + uTime * .02);
  vec3 color = palette(hue + sectorEnergy * .12) * rings * (.12 + sectorEnergy * 1.25 + bass * .35);
  color += palette(hue + .28) * (spokes + rails);
  color += palette(hue + .48) * exp(-radius * 8.5) * (.28 + bass * 1.7);
  return color * smoothstep(2.35, .05, radius);
}

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

vec3 particles(vec2 uv) {
  vec3 color = vec3(0.0);
  float speed = .18 + uLevel * 1.6;
  for (int index = 0; index < 30; index++) {
    float fi = float(index);
    float seed = hash21(vec2(fi, fi * 1.73));
    float band = uBands[index % 16];
    float angle = seed * PI * 2.0 + uTime * speed * (.15 + fract(seed * 9.0));
    float orbit = .08 + fract(seed * 17.0) * .92;
    orbit *= 1.0 + sin(uTime * 1.4 + seed * 20.0) * .08 + band * .18;
    vec2 point = vec2(cos(angle), sin(angle * 1.17 + seed * 3.0)) * orbit;
    float distance = length(uv - point);
    float glow = (.0018 + band * .006) / max(.001, distance * distance);
    color += palette(seed + uTime * .018 + band * .2) * glow;
  }
  float nebula = max(0.0, sin(uv.x * 7.0 - uv.y * 5.0 + uTime * .2)) * exp(-length(uv) * 2.3);
  color += palette(uTime * .01 + uv.x * .1) * nebula * (.03 + uLevel * .18);
  return color;
}

vec3 kaleidoscope(vec2 uv) {
  float radius = length(uv);
  float rawAngle = atan(uv.y, uv.x) + uTime * (.07 + uLevel * .2);
  float angularEnergy = bandAt(fract((rawAngle + PI) / (2.0 * PI)));
  float radialEnergy = bandAt(fract(radius * .72));
  float energy = max(angularEnergy, radialEnergy * .8);
  float segment = PI / 8.0;
  float angle = rawAngle;
  angle = abs(mod(angle + segment * .5, segment) - segment * .5);
  vec2 folded = vec2(cos(angle), sin(angle)) * radius;
  float petal = sin(folded.x * 13.0 - uTime * 1.45) * (.13 + energy * .045);
  float ribbonA = lineGlow(petal - folded.y, .006 + energy * .014);
  float ribbonB = lineGlow(cos(folded.x * 9.0 + uTime * 1.05) * .22 - folded.y + .23, .005 + radialEnergy * .012);
  float ribbonC = lineGlow(sin(folded.x * 20.0 + uTime * .72) * .055 - folded.y + .08, .004 + angularEnergy * .008);
  float rings = lineGlow(abs(fract(radius * (6.5 + radialEnergy * 2.5) - uTime * .13) - .5), .009 + energy * .008);
  float facets = pow(max(0.0, cos(folded.x * 22.0 + uTime) * cos(folded.y * 29.0 - uTime * .8)), 8.0);
  float beads = pow(max(0.0, cos(radius * 35.0 - uTime * 1.6)), 24.0);
  beads *= pow(max(0.0, cos(angle / segment * PI)), 16.0) * (.2 + energy);
  float core = exp(-radius * 7.5) * (1.0 + angularEnergy * 2.2);

  vec3 color = palette(angle / segment + radius * .52 + uTime * .024) * ribbonA * (.28 + energy * 1.25);
  color += palette(radius - uTime * .018 + .34) * ribbonB * (.17 + radialEnergy * .78);
  color += palette(rawAngle / PI + .62) * ribbonC * (.12 + angularEnergy * .72);
  color += palette(radius + angle + .12) * rings * (.06 + energy * .48);
  color += palette(radius * .7 + rawAngle * .08) * facets * (.08 + energy * .55);
  color += palette(rawAngle / PI + uTime * .02) * beads * .42;
  color += palette(uTime * .025 + radius) * core * .55;
  return color * smoothstep(2.05, .04, radius);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / max(1.0, uResolution.y);
  vec3 color;
  if (uMode == 0) color = tunnel(uv - vec2(1.75, 0.0));
  else if (uMode == 1) color = particles(uv - vec2(1.55, 0.0));
  else color = kaleidoscope((uv - vec2(1.45, 0.0)) * .64);
  color = 1.0 - exp(-color * (1.0 + uLevel * 1.4));
  outputColor = vec4(color, clamp(max(color.r, max(color.g, color.b)) * 1.18, 0.0, .92));
}
`;

export class ReactiveWebGLVisualizer {
  readonly available: boolean;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer?: WebGLRenderer;
  private readonly material?: ShaderMaterial;
  private readonly resolution = new Vector2(1, 1);
  private readonly bands = new Float32Array(16);
  private contextLost = false;
  private shaderValid = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      canvas.dispatchEvent(new CustomEvent('reactive-webgl-status', { detail: false }));
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      canvas.dispatchEvent(new CustomEvent('reactive-webgl-status', { detail: true }));
    });

    try {
      const context = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        failIfMajorPerformanceCaveat: true,
        powerPreference: 'high-performance',
        premultipliedAlpha: true,
        stencil: false,
      });
      if (!context) throw new Error('WebGL2 indisponible.');
      const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: false });
      renderer.debug.onShaderError = (gl, _program, vertexShaderHandle, fragmentShaderHandle) => {
        this.shaderValid = false;
        const vertexLog = gl.getShaderInfoLog(vertexShaderHandle) || '';
        const fragmentLog = gl.getShaderInfoLog(fragmentShaderHandle) || '';
        console.error('Compilation GLSL impossible.', { fragmentLog, vertexLog });
      };
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(1.5, Math.max(1, window.devicePixelRatio || 1)));
      const material = new ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        fragmentShader,
        glslVersion: GLSL3,
        transparent: true,
        uniforms: {
          uBands: { value: this.bands },
          uLevel: { value: 0 },
          uMode: { value: 0 },
          uResolution: { value: this.resolution },
          uTime: { value: 0 },
        },
        vertexShader,
      });
      const scene = new Scene();
      scene.add(new Mesh(new PlaneGeometry(2, 2), material));
      const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
      renderer.setAnimationLoop(null);
      this.renderer = renderer;
      this.material = material;
      this.scene = scene;
      this.camera = camera;
      this.available = true;
    } catch (error) {
      console.warn('Visualiseur WebGL désactivé :', error);
      this.available = false;
    }
  }

  private readonly scene?: Scene;
  private readonly camera?: OrthographicCamera;

  resize(width: number, height: number) {
    if (!this.renderer || width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.resolution.set(this.canvas.width, this.canvas.height);
  }

  render(mode: ReactiveWebGLMode, time: number, level: number, bands: readonly number[]): boolean {
    if (!this.available || this.contextLost || !this.shaderValid || !this.renderer || !this.material || !this.scene || !this.camera) return false;
    for (let index = 0; index < this.bands.length; index += 1) this.bands[index] = bands[index] || 0;
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uLevel!.value = level;
    this.material.uniforms.uMode!.value = mode === 'tunnel' ? 0 : mode === 'particles' ? 1 : 2;
    this.renderer.render(this.scene, this.camera);
    return this.shaderValid;
  }

  dispose() {
    this.material?.dispose();
    this.renderer?.dispose();
  }
}
