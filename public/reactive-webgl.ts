import {
  GLSL3,
  LinearFilter,
  Mesh,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

export type ReactiveWebGLMode = 'tunnel' | 'particles' | 'spiral' | 'plasma' | 'kaleidoscope' | 'fractal' | 'fluid' | 'feedback';

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
uniform float uSpeed;
uniform float uBands[64];
uniform float uGroups[6];
uniform int uMode;
uniform sampler2D uPrevious;
out vec4 outputColor;

#define PI 3.141592653589793

vec3 palette(float value) {
  return .54 + .46 * cos(6.28318 * (value + vec3(.02, .28, .58)));
}

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

float noise21(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  return mix(mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), local.x),
    mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + 1.0), local.x), local.y);
}

mat2 rotate2d(float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return mat2(cosine, -sine, sine, cosine);
}

float bandAt(float position) {
  float scaled = clamp(position, 0.0, .9999) * 63.0;
  int lower = int(floor(scaled));
  int upper = min(63, lower + 1);
  return mix(uBands[lower], uBands[upper], fract(scaled));
}

float lineGlow(float distance, float width) {
  return width / max(width, abs(distance));
}

vec2 audioWarp(vec2 uv, float amount) {
  float rotation = (uGroups[4] - uGroups[1]) * .18 + sin(uTime * .17) * .025;
  float zoom = 1.0 - (uGroups[0] * .055 + uGroups[1] * .035) * amount;
  uv = rotate2d(rotation * amount) * uv * zoom;
  float noise = noise21(uv * (3.2 + uGroups[5] * 3.0) + uTime * .19) - .5;
  uv += vec2(noise, noise21(uv.yx * 4.1 - uTime * .16) - .5) * (.018 + uGroups[4] * .035) * amount;
  return uv;
}

vec3 tunnel(vec2 uv) {
  float radius = length(uv);
  float angle = atan(uv.y, uv.x);
  float angularPosition = fract((angle + PI) / (2.0 * PI));
  float energy = bandAt(angularPosition);
  float perspective = 1.0 / max(.07, radius * (1.0 - energy * .12));
  float depth = perspective + uTime * (1.1 + uGroups[1] * 4.5);
  float rings = lineGlow(abs(fract(depth * .205) - .5), .009 + energy * .024);
  rings += lineGlow(abs(fract(depth * .41 + energy * .12) - .5), .005 + energy * .009) * .34;
  float spokes = pow(max(0.0, cos(angle * 16.0)), 26.0) * (.12 + energy * 1.2);
  vec3 color = palette(angularPosition + depth * .027 + uTime * .02) * rings * (.15 + energy + uGroups[1] * .5);
  color += palette(angularPosition + .32) * spokes;
  color += palette(uTime * .02 + .5) * exp(-radius * 8.0) * (.25 + uGroups[0] * 1.8);
  return color * smoothstep(2.3, .04, radius);
}

vec3 particles(vec2 uv) {
  vec3 color = vec3(0.0);
  for (int index = 0; index < 34; index++) {
    float fi = float(index);
    float seed = hash21(vec2(fi, fi * 1.73));
    float band = uBands[(index * 7) % 64];
    float angle = seed * PI * 2.0 + uTime * (.12 + uLevel * 1.3) * (.2 + fract(seed * 9.0));
    float orbit = (.08 + fract(seed * 17.0) * .95) * (1.0 + band * .18);
    vec2 point = vec2(cos(angle), sin(angle * 1.17 + seed * 3.0)) * orbit;
    float distance = length(uv - point);
    float glow = (.0015 + band * .006) / max(.001, distance * distance);
    color += palette(seed + uTime * .018 + band * .2) * glow;
  }
  return color;
}

vec3 spiral(vec2 uv) {
  float radius = length(uv);
  float angle = atan(uv.y, uv.x);
  float energy = bandAt(fract(radius * .72 + angle / (PI * 2.0)));
  float phase = angle * (5.0 + uGroups[3] * 3.0) - log(radius + .04) * (9.0 + uGroups[1] * 5.0) + uTime * (1.3 + uGroups[2] * 2.0);
  float arms = pow(.5 + .5 * cos(phase), 9.0);
  float filaments = lineGlow(sin(phase * .5 + radius * 25.0) * .12, .009 + energy * .018);
  vec3 color = palette(angle / PI * .25 + radius * .5 + uTime * .025) * arms * (.25 + energy * 1.5);
  color += palette(radius + .35) * filaments * (.07 + uGroups[4] * .32);
  color += palette(uTime * .03) * exp(-radius * 7.0) * (1.0 + uGroups[0] * 2.0);
  return color * smoothstep(1.7, .03, radius);
}

vec3 plasma(vec2 uv) {
  float n = noise21(uv * (4.0 + uGroups[5] * 2.0) + uTime * .22);
  float wave = sin(uv.x * (7.0 + uGroups[3] * 4.0) + uTime * 1.1);
  wave += sin(uv.y * (9.0 + uGroups[4] * 5.0) - uTime * .9);
  wave += sin(length(uv + vec2(sin(uTime * .3), cos(uTime * .27)) * .35) * 13.0 - uTime * 1.4);
  float field = wave / 3.0 + n * .7;
  float energy = bandAt(fract(field * .27 + .5));
  vec3 color = palette(field * .14 + uTime * .035 + energy * .16);
  color *= .12 + pow(abs(field), 1.7) * .42 + energy * .7;
  color += palette(field + .4) * lineGlow(abs(fract(field * 2.0) - .5), .018 + uGroups[4] * .025) * .16;
  return color;
}

vec3 kaleidoscope(vec2 uv) {
  float radius = length(uv);
  float rawAngle = atan(uv.y, uv.x) + uTime * (.06 + uLevel * .17);
  float segment = PI / (7.0 + floor(uGroups[4] * 4.0));
  float angle = abs(mod(rawAngle + segment * .5, segment) - segment * .5);
  vec2 folded = vec2(cos(angle), sin(angle)) * radius;
  float energy = max(bandAt(fract(rawAngle / (PI * 2.0) + .5)), bandAt(fract(radius * .7)));
  float ribbon = lineGlow(sin(folded.x * 14.0 - uTime * 1.4) * (.13 + energy * .05) - folded.y, .006 + energy * .014);
  float rings = lineGlow(abs(fract(radius * (6.0 + energy * 3.0) - uTime * .13) - .5), .008 + energy * .008);
  float facets = pow(max(0.0, cos(folded.x * 22.0 + uTime) * cos(folded.y * 29.0 - uTime * .8)), 8.0);
  vec3 color = palette(angle / segment + radius * .52 + uTime * .024) * ribbon * (.3 + energy * 1.3);
  color += palette(radius + .34) * rings * (.08 + energy * .5);
  color += palette(rawAngle / PI + .6) * facets * (.1 + uGroups[5] * .6);
  return color * smoothstep(2.0, .03, radius);
}

vec3 fractal(vec2 uv) {
  vec2 c = uv * (1.15 - uGroups[0] * .12) - vec2(.26, 0.0);
  c = rotate2d(uTime * .025 + uGroups[4] * .08) * c;
  vec2 z = vec2(0.0);
  float escaped = 0.0;
  float orbit = 10.0;
  for (int iteration = 0; iteration < 24; iteration++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    orbit = min(orbit, abs(z.x * z.y));
    if (dot(z, z) > 5.0 && escaped == 0.0) escaped = float(iteration) / 24.0;
  }
  float edge = exp(-orbit * (70.0 - uGroups[3] * 28.0));
  float energy = bandAt(fract(escaped + length(z) * .03));
  return palette(escaped + uTime * .018 + energy * .2) * (edge * (.16 + energy) + escaped * .18);
}

vec3 fluid(vec2 uv) {
  vec2 flow = uv;
  float energy = 0.0;
  for (int iteration = 0; iteration < 5; iteration++) {
    float fi = float(iteration);
    flow += vec2(sin(flow.y * (2.3 + fi) + uTime * (.35 + fi * .07)), cos(flow.x * (2.7 + fi) - uTime * (.3 + fi * .09))) * (.08 + uGroups[(iteration + 1) % 6] * .045);
    energy += sin(flow.x * (3.0 + fi) + cos(flow.y * (4.0 + fi)) + uTime * .5);
  }
  float density = energy / 5.0;
  float band = bandAt(fract(density * .3 + length(flow) * .2));
  vec3 color = palette(density * .18 + uTime * .02 + band * .2) * (.16 + abs(density) * .55 + band * .55);
  color += palette(flow.x * .12 + .6) * pow(max(0.0, 1.0 - abs(density)), 8.0) * uGroups[5] * .45;
  return color;
}

vec3 feedbackSeed(vec2 uv) {
  float radius = length(uv);
  float angle = atan(uv.y, uv.x);
  float band = bandAt(fract(angle / (PI * 2.0) + .5));
  float rays = pow(max(0.0, cos(angle * (9.0 + floor(uGroups[4] * 8.0)) + uTime)), 18.0);
  float rings = lineGlow(abs(fract(radius * (8.0 + uGroups[3] * 6.0) - uTime * .23) - .5), .006 + band * .014);
  return palette(angle / PI + radius + uTime * .03) * (rays * (.1 + band) + rings * (.05 + uGroups[5] * .4));
}

void main() {
  vec2 screenUv = gl_FragCoord.xy / max(vec2(1.0), uResolution);
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / max(1.0, uResolution.y);
  uv -= vec2(1.45, 0.0);
  uv = audioWarp(uv, uMode == 7 ? 1.7 : 1.0);

  vec3 current;
  if (uMode == 0) current = tunnel(uv - vec2(.25, 0.0));
  else if (uMode == 1) current = particles(uv - vec2(.1, 0.0));
  else if (uMode == 2) current = spiral(uv * .72);
  else if (uMode == 3) current = plasma(uv * .78);
  else if (uMode == 4) current = kaleidoscope(uv * .65);
  else if (uMode == 5) current = fractal(uv * .72);
  else if (uMode == 6) current = fluid(uv * .82);
  else current = feedbackSeed(uv * .72);

  float feedbackRotation = ((uGroups[4] - uGroups[2]) * .012 + (uMode == 7 ? .004 : .001)) * uSpeed;
  float feedbackZoom = 1.0 + (.004 + uGroups[0] * .008 + (uMode == 7 ? .006 : 0.0)) * uSpeed;
  vec2 feedbackUv = rotate2d(feedbackRotation) * (screenUv - .5) * feedbackZoom + .5;
  feedbackUv += vec2(noise21(screenUv * 6.0 + uTime) - .5, noise21(screenUv.yx * 7.0 - uTime) - .5) * uGroups[5] * .003;
  vec4 previous = texture(uPrevious, feedbackUv);
  float inside = step(0.0, feedbackUv.x) * step(feedbackUv.x, 1.0) * step(0.0, feedbackUv.y) * step(feedbackUv.y, 1.0);
  float feedbackAmount = pow(uMode == 7 ? .88 : .22, uSpeed) * inside;
  vec3 color = current + previous.rgb * feedbackAmount;
  color = 1.0 - exp(-color * (1.0 + uLevel * 1.35));
  float alpha = clamp(max(max(color.r, color.g), color.b) * 1.14 + previous.a * feedbackAmount, 0.0, .94);
  outputColor = vec4(color, alpha);
}
`;

const copyFragmentShader = `
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uResolution;
out vec4 outputColor;
void main() {
  outputColor = texture(uTexture, gl_FragCoord.xy / max(vec2(1.0), uResolution));
}
`;

const modeNumbers: Readonly<Record<ReactiveWebGLMode, number>> = Object.freeze({
  tunnel: 0,
  particles: 1,
  spiral: 2,
  plasma: 3,
  kaleidoscope: 4,
  fractal: 5,
  fluid: 6,
  feedback: 7,
});

function renderTarget() {
  return new WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    format: RGBAFormat,
    magFilter: LinearFilter,
    minFilter: LinearFilter,
    stencilBuffer: false,
    type: UnsignedByteType,
  });
}

export class ReactiveWebGLVisualizer {
  readonly available: boolean;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer?: WebGLRenderer;
  private readonly material?: ShaderMaterial;
  private readonly copyMaterial?: ShaderMaterial;
  private readonly resolution = new Vector2(1, 1);
  private readonly bands = new Float32Array(64);
  private readonly groups = new Float32Array(6);
  private readonly geometry?: PlaneGeometry;
  private readonly scene?: Scene;
  private readonly copyScene?: Scene;
  private readonly camera?: OrthographicCamera;
  private readTarget?: WebGLRenderTarget;
  private writeTarget?: WebGLRenderTarget;
  private contextLost = false;
  private shaderValid = true;
  private lastMode?: ReactiveWebGLMode;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      canvas.dispatchEvent(new CustomEvent('reactive-webgl-status', { detail: false }));
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.clearFeedback();
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
      renderer.debug.onShaderError = (gl, _program, vertexHandle, fragmentHandle) => {
        this.shaderValid = false;
        console.error('Compilation GLSL impossible.', {
          fragmentLog: gl.getShaderInfoLog(fragmentHandle) || '',
          vertexLog: gl.getShaderInfoLog(vertexHandle) || '',
        });
      };
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(1.5, Math.max(1, window.devicePixelRatio || 1)));

      const readTarget = renderTarget();
      const writeTarget = renderTarget();
      const material = new ShaderMaterial({
        blending: NoBlending,
        depthTest: false,
        depthWrite: false,
        fragmentShader,
        glslVersion: GLSL3,
        transparent: false,
        uniforms: {
          uBands: { value: this.bands },
          uGroups: { value: this.groups },
          uLevel: { value: 0 },
          uMode: { value: 0 },
          uPrevious: { value: readTarget.texture },
          uResolution: { value: this.resolution },
          uSpeed: { value: 1 },
          uTime: { value: 0 },
        },
        vertexShader,
      });
      const copyMaterial = new ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        fragmentShader: copyFragmentShader,
        glslVersion: GLSL3,
        transparent: true,
        uniforms: { uResolution: { value: this.resolution }, uTexture: { value: writeTarget.texture } },
        vertexShader,
      });
      const geometry = new PlaneGeometry(2, 2);
      const scene = new Scene();
      const copyScene = new Scene();
      scene.add(new Mesh(geometry, material));
      copyScene.add(new Mesh(geometry, copyMaterial));

      this.renderer = renderer;
      this.material = material;
      this.copyMaterial = copyMaterial;
      this.geometry = geometry;
      this.scene = scene;
      this.copyScene = copyScene;
      this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.readTarget = readTarget;
      this.writeTarget = writeTarget;
      this.available = true;
      this.clearFeedback();
    } catch (error) {
      console.warn('Visualiseur WebGL désactivé :', error);
      this.available = false;
    }
  }

  private clearFeedback() {
    if (!this.renderer || !this.readTarget || !this.writeTarget) return;
    const currentTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.readTarget);
    this.renderer.clear();
    this.renderer.setRenderTarget(this.writeTarget);
    this.renderer.clear();
    this.renderer.setRenderTarget(currentTarget);
  }

  resize(width: number, height: number) {
    if (!this.renderer || width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.resolution.set(this.canvas.width, this.canvas.height);
    this.readTarget?.setSize(this.canvas.width, this.canvas.height);
    this.writeTarget?.setSize(this.canvas.width, this.canvas.height);
    this.clearFeedback();
  }

  render(mode: ReactiveWebGLMode, time: number, level: number, bands: readonly number[], groups: readonly number[] = [], speed = 1): boolean {
    if (!this.available || this.contextLost || !this.shaderValid || !this.renderer || !this.material || !this.copyMaterial
      || !this.scene || !this.copyScene || !this.camera || !this.readTarget || !this.writeTarget) return false;
    if (mode !== this.lastMode) {
      this.lastMode = mode;
      this.clearFeedback();
    }
    for (let index = 0; index < this.bands.length; index += 1) this.bands[index] = bands[index] || 0;
    for (let index = 0; index < this.groups.length; index += 1) this.groups[index] = groups[index] || 0;
    this.material.uniforms.uTime!.value = time;
    this.material.uniforms.uLevel!.value = level;
    this.material.uniforms.uMode!.value = modeNumbers[mode];
    this.material.uniforms.uSpeed!.value = Math.max(.25, Math.min(2, speed));
    this.material.uniforms.uPrevious!.value = this.readTarget.texture;

    this.renderer.setRenderTarget(this.writeTarget);
    this.renderer.render(this.scene, this.camera);
    this.copyMaterial.uniforms.uTexture!.value = this.writeTarget.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.copyScene, this.camera);
    [this.readTarget, this.writeTarget] = [this.writeTarget, this.readTarget];
    return this.shaderValid;
  }

  dispose() {
    this.readTarget?.dispose();
    this.writeTarget?.dispose();
    this.material?.dispose();
    this.copyMaterial?.dispose();
    this.geometry?.dispose();
    this.renderer?.dispose();
  }
}
