import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';

export type MilkDropTheme = 'milkdrop-spiral' | 'milkdrop-fractal' | 'milkdrop-neon' | 'milkdrop-liquid';

const presetNames: Readonly<Record<MilkDropTheme, string>> = Object.freeze({
  'milkdrop-spiral': 'Flexi - infused with the spiral',
  'milkdrop-fractal': 'Flexi - smashing fractals [acid etching mix]',
  'milkdrop-neon': 'flexi + fishbrain - neon mindblob grafitti',
  'milkdrop-liquid': 'Cope - The Neverending Explosion of Red Liquid Fire',
});

const presets = butterchurnPresets.getPresets();
const butterchurnApi = (butterchurn as unknown as { default?: typeof butterchurn }).default ?? butterchurn;
const silentWaveform = new Uint8Array(1024).fill(128);

function decodeWaveform(encoded: string): Uint8Array {
  if (!encoded) return silentWaveform;
  try {
    const binary = window.atob(encoded);
    if (binary.length !== 1024) return silentWaveform;
    const samples = new Uint8Array(1024);
    for (let index = 0; index < samples.length; index += 1) samples[index] = binary.charCodeAt(index);
    return samples;
  } catch {
    return silentWaveform;
  }
}

export class MilkDropVisualizer {
  readonly available: boolean;
  private readonly visualizer?: ReturnType<typeof butterchurnApi.createVisualizer>;
  private waveform = silentWaveform;
  private currentTheme?: MilkDropTheme;
  private loadSequence = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    try {
      this.visualizer = butterchurnApi.createVisualizer(null, canvas, {
        meshHeight: 24,
        meshWidth: 32,
        outputFXAA: false,
        pixelRatio: 1,
        textureRatio: .8,
        width: 520,
        height: 130,
      });
      this.available = true;
    } catch (error) {
      console.warn('Moteur MilkDrop désactivé :', error);
      this.available = false;
    }
  }

  updateWaveform(encoded = '') {
    this.waveform = decodeWaveform(encoded);
  }

  resize(width: number, height: number) {
    if (!this.visualizer || width <= 0 || height <= 0) return;
    const pixelRatio = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    const renderWidth = Math.max(1, Math.round(width * pixelRatio));
    const renderHeight = Math.max(1, Math.round(height * pixelRatio));
    if (this.canvas.width === renderWidth && this.canvas.height === renderHeight) return;
    this.canvas.width = renderWidth;
    this.canvas.height = renderHeight;
    this.visualizer.setRendererSize(renderWidth, renderHeight, { pixelRatio: 1, textureRatio: .8 });
  }

  render(theme: MilkDropTheme, elapsedTime: number): boolean {
    if (!this.visualizer || !this.available) return false;
    if (theme !== this.currentTheme) this.loadTheme(theme);
    try {
      this.visualizer.render({
        audioLevels: {
          timeByteArray: this.waveform,
          timeByteArrayL: this.waveform,
          timeByteArrayR: this.waveform,
        },
        elapsedTime,
      });
      return true;
    } catch (error) {
      console.warn('Frame MilkDrop ignorée :', error);
      return false;
    }
  }

  private loadTheme(theme: MilkDropTheme) {
    this.currentTheme = theme;
    const preset = presets[presetNames[theme]];
    if (!preset) {
      console.warn(`Preset MilkDrop introuvable : ${presetNames[theme]}`);
      return;
    }
    const sequence = ++this.loadSequence;
    Promise.resolve(this.visualizer?.loadPreset(preset, this.loadSequence === 1 ? 0 : 1.5)).catch((error) => {
      if (sequence === this.loadSequence) console.warn(`Preset MilkDrop impossible à charger : ${presetNames[theme]}`, error);
    });
  }

  dispose() {
    try {
      this.visualizer?.loseGLContext();
    } catch {
      // Le contexte peut déjà avoir été libéré par Electron.
    }
  }
}
