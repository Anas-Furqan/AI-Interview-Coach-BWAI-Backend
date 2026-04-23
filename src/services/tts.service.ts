import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { env } from '../config/env';

const credentials = JSON.parse(env.gcpCredentialsJson);
const ttsClient = new TextToSpeechClient({ credentials });

export async function synthesizeInterviewAudio(text: string, languageCode: string, selectedVoice?: string): Promise<string | null> {
  try {
    const fallbackVoice = languageCode.startsWith('ur') ? 'ur-PK-Wavenet-A' : 'en-US-Chirp3-HD-Aoede';
    const voiceName = selectedVoice || fallbackVoice;

    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: { languageCode, name: voiceName },
      audioConfig: { audioEncoding: 'MP3' },
    });

    if (response.audioContent && Buffer.isBuffer(response.audioContent)) {
      return response.audioContent.toString('base64');
    }

    return null;
  } catch (error) {
    console.error('TTS generation failed:', error);
    return null;
  }
}
