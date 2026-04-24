import { SpeechClient } from '@google-cloud/speech';
import { resolveGoogleCredentials } from '../config/gcpCredentials';

const credentials = resolveGoogleCredentials();
const sttClient = credentials ? new SpeechClient({ credentials }) : new SpeechClient();

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
