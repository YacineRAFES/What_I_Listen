const BAND_COUNT = 16;
const UPDATE_INTERVAL = 33;

function createBands(data) {
  const bands = [];
  const last = data.length - 1;

  for (let band = 0; band < BAND_COUNT; band += 1) {
    const start = Math.floor(((band / BAND_COUNT) ** 2) * last);
    const end = Math.max(start + 1, Math.floor((((band + 1) / BAND_COUNT) ** 2) * last));
    let total = 0;
    for (let index = start; index < end; index += 1) total += data[index];
    const average = total / (end - start) / 255;
    bands.push(Math.min(1, Math.pow(average, 0.68) * 1.12));
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
    });
  }
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) throw new Error('Windows n’a fourni aucune piste audio système.');

  stream.getVideoTracks().forEach((track) => { track.enabled = false; });
  audioTracks.forEach((track) => track.addEventListener('ended', () => {
    window.audioCapture.reportError('La capture audio Windows a été arrêtée.');
  }));

  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.minDecibels = -90;
  analyser.maxDecibels = -20;
  analyser.smoothingTimeConstant = 0.72;
  context.createMediaStreamSource(stream).connect(analyser);
  await context.resume();

  const data = new Uint8Array(analyser.frequencyBinCount);
  let lastUpdate = 0;
  const publish = (now) => {
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
