import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { attachSttWebSocket } from './websocket/stt.websocket';

const app = createApp();
const server = http.createServer(app);

attachSttWebSocket(server);

server.listen(env.port, () => {
  console.log(`Server is listening for HTTP and WS on port ${env.port}`);
});
