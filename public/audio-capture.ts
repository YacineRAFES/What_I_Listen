const BAND_COUNT = 16;
const UPDATE_INTERVAL = 33;

function createBands(data: Uint8Array): number[] {
  const bands = [];
  const last = data.length - 1;

  for (let band = 0; band < BAND_COUNT; band += 1) {
    const start = Math.floor(((band / BAND_COUNT) ** 2) * last);
    const end = Math.max(start + 1, Math.floor((((band + 1) / BAND_COUNT) ** 2) * last));
    let total = 0;
    for (let index = start; index < end; index += 1) total += data[index];
    const average = total / (end - start) / 255;
    // Les niveaux bas restent lisibles dans l'overlay, sans inventer de signal lorsqu'il n'y a pas de son.
    bands.push(Math.min(1, Math.pow(average, 0.52) * 1.35));
  }

  return bands;
}

async function startCapture() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
  } catch {
    const sourceId = await window.audioCapture.getSourceId();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } },
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } },
    } as MediaStreamConstraints);
  }
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) throw new Error('Windows n’a fourni aucune piste audio système.');

  stream.getVideoTracks().forEach((track) => { track.enabled = false; });
  audioTracks.forEach((track) => track.addEventListener('ended', () => {
    window.audioCapture.reportError('La capture audio Windows a été arrêtée.');
  }));

  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.minDecibels = -90;
  analyser.maxDecibels = -20;
  analyser.smoothingTimeConstant = 0.58;
  const silence = context.createGain();
  silence.gain.value = 0;
  context.createMediaStreamSource(stream).connect(analyser);
  // Sans destination, Chromium peut ne pas traiter ce graphe audio. Cette branche le maintient actif,
  // tout en évitant de diffuser le son capturé une seconde fois.
  analyser.connect(silence).connect(context.destination);
  await context.resume();

  const data = new Uint8Array(analyser.frequencyBinCount);
  let lastUpdate = 0;
  const publish = (now: number) => {
    analyser.getByteFrequencyData(data);
    if (now - lastUpdate >= UPDATE_INTERVAL) {
      const bands = createBands(data);
      const level = bands.reduce((total, band) => total + band, 0) / bands.length;
      window.audioCapture.publishLevels({ bands, level });
      lastUpdate = now;
    }
    window.requestAnimationFrame(publish);
  };
  window.requestAnimationFrame(publish);
}

startCapture().catch((error) => {
  window.audioCapture.reportError(error.message);
});
