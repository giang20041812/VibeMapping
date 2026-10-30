import { createApp } from './app.js';
import { env } from './config/env.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`API chạy tại http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
