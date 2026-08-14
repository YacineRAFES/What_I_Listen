const { app, BrowserWindow } = require('electron');
const { buildSync } = require('esbuild');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'wil-webgl-'));
const targetUrl = process.argv[2] || '';
const entryPoint = resolve(process.cwd(), 'public', 'reactive-webgl.ts');
const milkDropEntryPoint = resolve(process.cwd(), 'public', 'milkdrop.ts');
const scriptPath = join(temporaryDirectory, 'smoke.js');
const pagePath = join(temporaryDirectory, 'index.html');

buildSync({
  bundle: true,
  format: 'esm',
  outfile: scriptPath,
  platform: 'browser',
  stdin: {
    contents: `
      import { ReactiveWebGLVisualizer } from ${JSON.stringify(entryPoint)};
      import { MilkDropVisualizer } from ${JSON.stringify(milkDropEntryPoint)};
      const [canvas, milkDropCanvas] = document.querySelectorAll('canvas');
      const visualizer = new ReactiveWebGLVisualizer(canvas);
      visualizer.resize(520, 130);
      const bands = Array.from({ length: 64 }, (_, index) => .15 + (index % 5) * .12);
      const groups = [.42, .64, .37, .51, .46, .32];
      const modes = ['tunnel', 'particles', 'spiral', 'plasma', 'kaleidoscope', 'fractal', 'fluid', 'feedback'];
      const rendered = modes.every((mode, index) => visualizer.render(mode, index + .5, .64, bands, groups));
      const gl = canvas.getContext('webgl2');
      const milkDrop = new MilkDropVisualizer(milkDropCanvas);
      milkDrop.resize(520, 130);
      const waveform = new Uint8Array(1024);
      waveform.forEach((_, index) => { waveform[index] = Math.round(128 + Math.sin(index * .12) * 92); });
      milkDrop.updateWaveform(btoa(String.fromCharCode(...waveform)));
      const themes = ['milkdrop-spiral', 'milkdrop-fractal', 'milkdrop-neon', 'milkdrop-liquid'];
      let milkDropRendered = true;
      for (const theme of themes) {
        for (let frame = 0; frame < 8; frame += 1) {
          milkDropRendered = milkDrop.render(theme, 1 / 30) && milkDropRendered;
          await new Promise((resolve) => setTimeout(resolve, 8));
        }
      }
      window.webglSmoke = {
        available: visualizer.available,
        height: canvas.height,
        milkDropAvailable: milkDrop.available,
        milkDropRendered,
        rendered,
        renderer: gl?.getParameter(gl.RENDERER) || '',
        width: canvas.width,
        webgl2: Boolean(gl),
      };
    `,
    loader: 'ts',
    resolveDir: process.cwd(),
  },
  target: ['chrome140'],
});

writeFileSync(pagePath, '<!doctype html><meta charset="utf-8"><canvas></canvas><canvas></canvas><script type="module" src="./smoke.js"></script>');

app.setPath('userData', join(temporaryDirectory, 'profile'));
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('use-angle', 'swiftshader');

const timeout = setTimeout(() => {
  console.error('Le test WebGL Electron a dépassé le délai autorisé.');
  app.exit(1);
}, 12_000);

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    height: 130,
    show: false,
    useContentSize: true,
    webPreferences: { backgroundThrottling: false, contextIsolation: true, nodeIntegration: false },
    width: 520,
  });
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error' || /MilkDrop|GLSL|WebGL/i.test(event.message)) console.error(`Renderer: ${event.message}`);
  });

  try {
    if (targetUrl) await window.loadURL(targetUrl);
    else await window.loadFile(pagePath);
    const result = targetUrl
      ? await window.webContents.executeJavaScript(`new Promise((resolve) => setTimeout(() => {
          const canvas = document.querySelector('#reactive-webgl');
          const card = document.querySelector('#now-playing');
          const title = document.querySelector('#title');
          const gl = canvas?.getContext('webgl2');
          const extension = gl?.getExtension('WEBGL_lose_context');
          const base = {
              available: !card?.classList.contains('webgl-fallback'),
              contextLossSupported: Boolean(extension),
              height: canvas?.height || 0,
              mode: card?.dataset.visualizer || '',
              rendered: Boolean(gl),
              renderer: gl?.getParameter(gl.RENDERER) || '',
              titleWidth: title?.clientWidth || 0,
              width: canvas?.width || 0,
              webgl2: Boolean(gl),
          };
          if (!extension) return resolve(base);
          extension.loseContext();
          setTimeout(() => resolve({ ...base, fallbackAfterContextLoss: card?.classList.contains('webgl-fallback') }), 80);
        }, 1200))`)
      : await window.webContents.executeJavaScript(`new Promise((resolve) => {
          const started = Date.now();
          const timer = setInterval(() => {
            if (window.webglSmoke || Date.now() - started > 8000) {
              clearInterval(timer);
              resolve(window.webglSmoke || null);
            }
          }, 25);
        })`);
    console.log(JSON.stringify(result));
    const fallbackFailed = result?.contextLossSupported && !result.fallbackAfterContextLoss;
    const titleWidthFailed = targetUrl && result.titleWidth < 340;
    const milkDropFailed = !targetUrl && (!result?.milkDropAvailable || !result.milkDropRendered);
    const failed = !result?.webgl2 || !result.available || !result.rendered || milkDropFailed || fallbackFailed || titleWidthFailed || result.width < 100 || result.height < 50;
    clearTimeout(timeout);
    window.destroy();
    app.exit(failed ? 1 : 0);
  } catch (error) {
    console.error(error);
    clearTimeout(timeout);
    window.destroy();
    app.exit(1);
  }
}).catch((error) => {
  clearTimeout(timeout);
  console.error(error);
  app.exit(1);
});
