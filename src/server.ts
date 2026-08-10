import { startOverlayService } from './overlay-service.js';

const service = await startOverlayService();
console.log(`What I Listen est prêt : ${service.url}`);
console.log(`Filtre de session média : ${process.env.MEDIA_APP ?? 'deezer'}`);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await service.close();
}

process.once('SIGINT', () => shutdown().finally(() => process.exit(0)));
process.once('SIGTERM', () => shutdown().finally(() => process.exit(0)));
