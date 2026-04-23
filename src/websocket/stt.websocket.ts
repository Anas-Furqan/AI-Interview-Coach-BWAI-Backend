import { Server as HttpServer } from 'http';
import WebSocket, { WebSocketServer, RawData } from 'ws';
import { createStreamingRecognize } from '../services/stt.service';

export function attachSttWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', ws => {
    let recognizeStream: any = null;

    ws.on('message', (message: RawData) => {
      const msgStr = message.toString();

      if (msgStr.includes('config')) {
        try {
          const configMsg = JSON.parse(msgStr);
          const languageCode = configMsg?.config?.languageCode || 'en-US';
          if (recognizeStream) recognizeStream.destroy();

          recognizeStream = createStreamingRecognize(languageCode)
            .on('error', (err: Error) => console.error('STT stream error:', err.message))
            .on('data', (data: unknown) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(data));
              }
            });

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ status: 'ready' }));
          }
        } catch (error) {
          console.error('Failed to parse STT config message:', error);
        }
        return;
      }

      if (msgStr.includes('stop')) {
        if (recognizeStream) recognizeStream.end();
        return;
      }

      if (recognizeStream && Buffer.isBuffer(message) && !recognizeStream.destroyed) {
        recognizeStream.write(message);
      }
    });

    ws.on('close', () => {
      if (recognizeStream) recognizeStream.destroy();
    });
  });
}
