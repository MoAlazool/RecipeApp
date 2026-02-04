// Safe wrapper for expo-speech-recognition
// Returns the actual package exports in native builds,
// falls back to no-ops in Expo Go (no crash)

export let ExpoSpeechRecognitionModule: any = null;
export let useSpeechRecognitionEvent: any = (_event: string, _listener: any) => {};
export let VOICE_AVAILABLE = false;

try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
  VOICE_AVAILABLE = !!mod.ExpoSpeechRecognitionModule;
} catch {
  // Native module not available (Expo Go)
}
