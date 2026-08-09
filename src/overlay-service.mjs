import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSessionManager } from 'windows-media-sessions';

const root = dirname(fileURLToPath(import.meta.url));
const publicDirectory = join(root, '..', 'public');
const visualizerModes = new Set(['bars', 'ripple', 'pulse', 'off']);
const supportedLanguages = new Set(['fr', 'en']);
const defaultSettings = Object.freeze({ visualizer: 'bars', startHidden: true, language: 'fr' });

function parsePort(raw, fallback) {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : fallback;
}

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]);
}

function normalizeVisualizer(value) {
  return visualizerModes.has(value) ? value : 'bars';
}

function normalizeLanguage(value) {
  return supportedLanguages.has(value) ? value : defaultSettings.language;
}

async function loadSettings(settingsPath) {
  if (!settingsPath) return { ...defaultSettings };
  try {
    const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
    return {
      visualizer: normalizeVisualizer(settings.visualizer),
      startHidden: typeof settings.startHidden === 'boolean' ? settings.startHidden : defaultSettings.startHidden,
      language: normalizeLanguage(settings.language),
    };
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`Paramètres du visualiseur ignorés : ${error.message}`);
    return { ...defaultSettings };
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2048) request.destroy(new Error('Requête trop volumineuse.'));
    });
    request.on('error', reject);
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON invalide.'));
      }
    });
  });
}

export async function startOverlayService({
  host = '127.0.0.1',
  port = parsePort(process.env.PORT, 38491),
  mediaAppFilter = (process.env.MEDIA_APP ?? 'deezer').trim().toLowerCase(),
  backendPath,
  settingsPath,
} = {}) {
  const savedSettings = await loadSettings(settingsPath);
  const state = {
    available: false,
    title: '',
    artist: '',
    album: '',
    playback: 'stopped',
    source: '',
    thumbnail: '',
    visualizer: savedSettings.visualizer,
    startHidden: savedSettings.startHidden,
    language: savedSettings.language,
    version: 0,
    error: '',
  };

  const manager = createSessionManager(backendPath ? { backendPath } : undefined);
  let stopListening = () => {};
  let isListening = false;
  const settingsListeners = new Set();

  function matchesConfiguredApp(session) {
    const appId = String(session.sourceAppUserModelId ?? '').toLowerCase();
    const appName = String(session.sourceAppDisplayName ?? '').toLowerCase();
    return appId.includes(mediaAppFilter) || appName.includes(mediaAppFilter);
  }

  function chooseSession(sessions) {
    const candidates = sessions.filter(matchesConfiguredApp);
    return candidates.find((session) => session.playbackStatus === 'playing') ?? candidates[0] ?? null;
  }

  function updateState(sessions) {
    const session = chooseSession(sessions);
    const next = session
      ? {
          available: Boolean(session.title || session.artist),
          title: session.title ?? '',
          artist: session.artist ?? '',
          album: session.albumTitle ?? '',
          playback: session.playbackStatus,
          source: session.sourceAppDisplayName || session.sourceAppUserModelId || 'Deezer',
          thumbnail: session.thumbnail ?? '',
          error: '',
        }
      : {
          available: false,
          title: '',
          artist: '',
          album: '',
          playback: 'stopped',
          source: '',
          thumbnail: '',
          error: '',
        };

    const changed = ['available', 'title', 'artist', 'album', 'playback', 'source', 'thumbnail']
      .some((key) => state[key] !== next[key]);
    Object.assign(state, next);
    if (changed) state.version += 1;
  }

  function stateForClient() {
    return {
      available: state.available,
      title: state.title,
      artist: state.artist,
      album: state.album,
      playback: state.playback,
      source: state.source,
      error: state.error || undefined,
      version: state.version,
      visualizer: state.visualizer,
      language: state.language,
      coverUrl: `/cover/${state.version}`,
    };
  }

  function settingsForClient() {
    return {
      visualizer: state.visualizer,
      startHidden: state.startHidden,
      language: state.language,
    };
  }

  async function saveSettings() {
    if (!settingsPath) return;
    await writeFile(settingsPath, `${JSON.stringify(settingsForClient(), null, 2)}\n`, 'utf8');
  }

  function notifySettingsChanged() {
    const settings = settingsForClient();
    settingsListeners.forEach((listener) => {
      try {
        listener(settings);
      } catch (error) {
        console.warn(`Écouteur de paramètres ignoré : ${error.message}`);
      }
    });
  }

  function svgPlaceholder() {
    const initial = (state.title || state.artist || '♫').trim().slice(0, 1).toUpperCase();
    const safeInitial = escapeXml(initial);
    const safeArtist = escapeXml((state.artist || 'Deezer').slice(0, 35));
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#9d4edd"/><stop offset="1" stop-color="#2d1157"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <circle cx="256" cy="235" r="124" fill="#ffffff" fill-opacity=".14"/>
  <text x="256" y="278" fill="white" font-family="Segoe UI, sans-serif" font-size="180" font-weight="700" text-anchor="middle">${safeInitial}</text>
  <text x="256" y="420" fill="white" fill-opacity=".75" font-family="Segoe UI, sans-serif" font-size="28" text-anchor="middle">${safeArtist}</text>
</svg>`;
  }

  function send(response, status, type, body) {
    response.writeHead(status, {
      'Cache-Control': 'no-store',
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(body);
  }

  function sendCover(response) {
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/i.exec(state.thumbnail);
    if (match) {
      send(response, 200, match[1], Buffer.from(match[2], 'base64'));
      return;
    }
    send(response, 200, 'image/svg+xml; charset=utf-8', svgPlaceholder());
  }

  async function sendStatic(response, name, type) {
    try {
      send(response, 200, type, await readFile(join(publicDirectory, name)));
    } catch (error) {
      console.error(`Impossible de charger ${name}:`, error.message);
      send(response, 500, 'text/plain; charset=utf-8', 'Erreur interne.');
    }
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${host}:${port}`);
    if (request.method === 'POST' && url.pathname === '/api/visualizer') {
      try {
        const payload = await readJsonBody(request);
        const visualizer = normalizeVisualizer(payload.visualizer);
        if (visualizer !== payload.visualizer) throw new Error('Visualiseur inconnu.');
        state.visualizer = visualizer;
        await saveSettings();
        notifySettingsChanged();
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify({ visualizer }));
      } catch (error) {
        send(response, 400, 'application/json; charset=utf-8', JSON.stringify({ error: error.message }));
      }
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/settings') {
      try {
        const payload = await readJsonBody(request);
        const updatesStartHidden = Object.hasOwn(payload, 'startHidden');
        const updatesLanguage = Object.hasOwn(payload, 'language');
        if (!updatesStartHidden && !updatesLanguage) throw new Error('Aucun paramètre à enregistrer.');
        if (updatesStartHidden && typeof payload.startHidden !== 'boolean') throw new Error('Valeur de démarrage invalide.');
        if (updatesLanguage && !supportedLanguages.has(payload.language)) throw new Error('Langue non prise en charge.');
        if (updatesStartHidden) state.startHidden = payload.startHidden;
        if (updatesLanguage) state.language = payload.language;
        await saveSettings();
        notifySettingsChanged();
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify(settingsForClient()));
      } catch (error) {
        send(response, 400, 'application/json; charset=utf-8', JSON.stringify({ error: error.message }));
      }
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(response, 405, 'text/plain; charset=utf-8', 'Méthode non autorisée.');
      return;
    }
    if (request.method === 'HEAD') {
      response.writeHead(200);
      response.end();
      return;
    }

    switch (url.pathname) {
      case '/':
      case '/index.html':
        await sendStatic(response, 'index.html', 'text/html; charset=utf-8');
        break;
      case '/overlay.css':
        await sendStatic(response, 'overlay.css', 'text/css; charset=utf-8');
        break;
      case '/overlay.js':
        await sendStatic(response, 'overlay.js', 'text/javascript; charset=utf-8');
        break;
      case '/app':
      case '/app.html':
        await sendStatic(response, 'app.html', 'text/html; charset=utf-8');
        break;
      case '/app.css':
        await sendStatic(response, 'app.css', 'text/css; charset=utf-8');
        break;
      case '/app.js':
        await sendStatic(response, 'app.js', 'text/javascript; charset=utf-8');
        break;
      case '/i18n.js':
        await sendStatic(response, 'i18n.js', 'text/javascript; charset=utf-8');
        break;
      case '/visualizer':
      case '/visualizer.html':
        await sendStatic(response, 'visualizer.html', 'text/html; charset=utf-8');
        break;
      case '/visualizer.css':
        await sendStatic(response, 'visualizer.css', 'text/css; charset=utf-8');
        break;
      case '/visualizer.js':
        await sendStatic(response, 'visualizer.js', 'text/javascript; charset=utf-8');
        break;
      case '/settings':
      case '/settings.html':
        await sendStatic(response, 'settings.html', 'text/html; charset=utf-8');
        break;
      case '/settings.css':
        await sendStatic(response, 'settings.css', 'text/css; charset=utf-8');
        break;
      case '/settings.js':
        await sendStatic(response, 'settings.js', 'text/javascript; charset=utf-8');
        break;
      case '/api/now-playing':
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify(stateForClient()));
        break;
      case '/api/health':
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify({
          ok: !state.error,
          sourceFilter: mediaAppFilter,
          error: state.error || undefined,
        }));
        break;
      case '/api/visualizer':
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify({ visualizer: state.visualizer }));
        break;
      case '/api/settings':
        send(response, 200, 'application/json; charset=utf-8', JSON.stringify(settingsForClient()));
        break;
      default:
        if (url.pathname === '/cover' || /^\/cover\/\d+$/.test(url.pathname)) {
          sendCover(response);
        } else {
          send(response, 404, 'text/plain; charset=utf-8', 'Introuvable.');
        }
    }
  });

  manager.on('error', (error) => {
    state.error = error.message;
    console.error(`Windows Media Sessions : ${error.message}`);
  });
  manager.on('diagnostic', (error) => console.warn(`Windows Media Sessions : ${error.message}`));
  stopListening = manager.onSessionsChanged(updateState);
  manager.getAllSessions().then(updateState).catch((error) => {
    state.error ||= error.message;
    console.error(`Initialisation Windows Media Sessions impossible : ${error.message}`);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      isListening = true;
      resolve();
    });
  });

  return {
    host,
    port,
    url: `http://${host}:${port}/`,
    state: stateForClient,
    settings: settingsForClient,
    onSettingsChanged(listener) {
      settingsListeners.add(listener);
      return () => settingsListeners.delete(listener);
    },
    async close() {
      stopListening();
      if (isListening) {
        await new Promise((resolve) => server.close(resolve));
        isListening = false;
      }
      await manager.stop();
    },
  };
}
