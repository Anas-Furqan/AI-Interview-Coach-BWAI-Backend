import { SpeechClient } from '@google-cloud/speech';
import { env } from '../config/env';

const credentials = JSON.parse(env.gcpCredentialsJson);
const sttClient = new SpeechClient({ credentials });

export function createStreamingRecognize(languageCode: string) {
  return sttClient.streamingRecognize({
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode,
      enableAutomaticPunctuation: true,
    },
    interimResults: true,
  });
}
