// `npm run dev`: starts the Vite dev server and opens it in the Electron app,
// with hot reload. Closing the window stops both.
import { spawn } from 'node:child_process';
import electron from 'electron';
import { createServer } from 'vite';

const server = await createServer();
await server.listen();
const url = server.resolvedUrls.local[0];
console.log(`Vite ready at ${url}, starting Raster…`);

const app = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});
app.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
