import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { resolveGoogleCredentials } from '../config/gcpCredentials';

const credentials = resolveGoogleCredentials();
const ttsClient = credentials ? new TextToSpeechClient({ credentials }) : new TextToSpeechClient();

function toBase64Audio(audioContent: unknown): string | null {
  if (!audioContent) {
    return null;
  }

  if (typeof audioContent === 'string') {
    return audioContent;
  }

  if (Buffer.isBuffer(audioContent)) {
    return audioContent.toString('base64');
  }

  if (audioContent instanceof Uint8Array) {
    return Buffer.from(audioContent).toString('base64');
  }

  return null;
}

function getVoiceFallbacks(languageCode: string): string[] {
  if (languageCode.startsWith('ur')) {
    return ['ur-PK-Wavenet-A', 'ur-PK-Wavenet-B', 'ur-PK-Standard-A', 'ur-PK-Standard-B'];
  }

  if (languageCode.startsWith('en-US')) {
    return ['en-US-Chirp3-HD-Aoede', 'en-US-Neural2-F', 'en-US-Standard-C'];
  }

  return [];
}

async function synthesizeWithVoice(text: string, languageCode: string, voiceName?: string): Promise<string | null> {
  const voice = voiceName ? { languageCode, name: voiceName } : { languageCode };
  const [response] = await ttsClient.synthesizeSpeech({
    input: { text },
    voice,
    audioConfig: { audioEncoding: 'MP3' },
  });

  return toBase64Audio(response.audioContent);
}

export async function synthesizeInterviewAudio(text: string, languageCode: string, selectedVoice?: string): Promise<string | null> {
  const fallbackVoices = getVoiceFallbacks(languageCode);
  const voiceCandidates = [selectedVoice, ...fallbackVoices].filter((name, index, arr): name is string => {
    return Boolean(name) && arr.indexOf(name) === index;
  });

  let lastError: unknown = null;

  try {
    for (const voiceName of voiceCandidates) {
      try {
        const audioBase64 = await synthesizeWithVoice(text, languageCode, voiceName);
        if (audioBase64) {
          return audioBase64;
        }
      } catch (error) {
        lastError = error;
      }
    }

    const genericAudio = await synthesizeWithVoice(text, languageCode);
    if (genericAudio) {
      return genericAudio;
    }

    if (lastError) {
      console.error('TTS generation failed for all voice options:', lastError);
    }

    return null;
  } catch (error) {
    console.error('TTS generation failed:', error);
    return null;
  }
}
