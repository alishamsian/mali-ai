import { useCallback, useEffect, useState } from 'react';
import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'done'
  | 'silent'
  | 'offline'
  | 'denied'
  | 'unavailable'
  | 'error';

type SpeechInputModule = {
  isAvailable: () => Promise<boolean>;
  start: (locale: string) => Promise<void>;
  stop: () => void;
  cancel: () => void;
};

const speech: SpeechInputModule | undefined =
  Platform.OS === 'android' ? NativeModules.SpeechInput : undefined;

const LOCALE = 'fa-IR';
/** android.speech.SpeechRecognizer error codes, grouped by what the user can do about them. */
function stateForError(code: number): VoiceState {
  switch (code) {
    case 1: // ERROR_NETWORK_TIMEOUT
    case 2: // ERROR_NETWORK
      return 'offline';
    case 6: // ERROR_SPEECH_TIMEOUT
    case 7: // ERROR_NO_MATCH
      return 'silent';
    case 9: // ERROR_INSUFFICIENT_PERMISSIONS
      return 'denied';
    case 12: // ERROR_LANGUAGE_NOT_SUPPORTED
    case 13: // ERROR_LANGUAGE_UNAVAILABLE
      return 'unavailable';
    default:
      return 'error';
  }
}

async function ensureMicPermission(): Promise<boolean> {
  const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  if (await PermissionsAndroid.check(permission)) {
    return true;
  }
  return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}

/** Speech-to-text through the phone's speech service, with live partial results. */
export function useVoiceEntry() {
  const [state, setState] = useState<VoiceState>(speech ? 'idle' : 'unavailable');
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    if (!speech) {
      return;
    }
    const emitter = new NativeEventEmitter(NativeModules.SpeechInput);
    const subs = [
      emitter.addListener('SpeechPartial', (e: { text?: string }) => {
        if (e.text) {
          setTranscript(e.text);
        }
      }),
      emitter.addListener('SpeechResult', (e: { text?: string }) => {
        setTranscript(prev => e.text || prev);
        setState('done');
      }),
      emitter.addListener('SpeechError', (e: { code?: number }) => {
        setState(stateForError(e.code ?? -1));
      }),
    ];
    return () => {
      subs.forEach(sub => sub.remove());
      speech.cancel();
    };
  }, []);

  const start = useCallback(async () => {
    if (!speech) {
      return;
    }
    if (!(await ensureMicPermission())) {
      setState('denied');
      return;
    }
    if (!(await speech.isAvailable())) {
      setState('unavailable');
      return;
    }
    setTranscript('');
    try {
      await speech.start(LOCALE);
      setState('listening');
    } catch {
      setState('error');
    }
  }, []);

  const stop = useCallback(() => speech?.stop(), []);

  return { state, transcript, start, stop };
}
