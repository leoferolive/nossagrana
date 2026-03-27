import { useState, useCallback, useRef, useEffect } from 'react';

interface SpeechRecognitionEvent {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isConnected: boolean;
  transcript: string;
  finalTranscript: string;
  error: string | null;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed']);
const MAX_RESTARTS = 15;

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInterimRef = useRef('');
  const stoppingRef = useRef(false);
  const hadFatalErrorRef = useRef(false);
  const restartCountRef = useRef(0);
  const isSupported = getSpeechRecognition() !== null;

  useEffect(() => {
    return () => {
      stoppingRef.current = true;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    // Cancel any pending restart timer
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      stoppingRef.current = true;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setError('not-supported');
      return;
    }

    setError(null);
    setTranscript('');
    setFinalTranscript('');
    setIsConnected(false);
    stoppingRef.current = false;
    hadFatalErrorRef.current = false;
    restartCountRef.current = 0;
    lastInterimRef.current = '';

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      setIsConnected(true);
      restartCountRef.current = 0;
      let interim = '';
      let final = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (final) {
        setFinalTranscript((prev) => prev + final);
        lastInterimRef.current = '';
      } else {
        lastInterimRef.current = interim;
      }
      setTranscript(interim || final);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (FATAL_ERRORS.has(e.error)) {
        hadFatalErrorRef.current = true;
        const errorMap: Record<string, string> = {
          'not-allowed': 'no-permission',
          'service-not-allowed': 'no-permission',
        };
        setError(errorMap[e.error] ?? e.error);
      }
    };

    recognition.onend = () => {
      if (stoppingRef.current) {
        stoppingRef.current = false;
        if (lastInterimRef.current) {
          setFinalTranscript((prev) => prev + lastInterimRef.current);
          lastInterimRef.current = '';
        }
        setIsListening(false);
        setIsConnected(false);
        return;
      }

      if (hadFatalErrorRef.current) {
        setIsListening(false);
        setIsConnected(false);
        return;
      }

      restartCountRef.current += 1;
      if (restartCountRef.current > MAX_RESTARTS) {
        setError('network');
        if (lastInterimRef.current) {
          setFinalTranscript((prev) => prev + lastInterimRef.current);
          lastInterimRef.current = '';
        }
        setIsListening(false);
        setIsConnected(false);
        return;
      }

      const delay = Math.min(restartCountRef.current * 500, 2000);
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (stoppingRef.current) return;
        try {
          recognition.start();
        } catch {
          if (lastInterimRef.current) {
            setFinalTranscript((prev) => prev + lastInterimRef.current);
            lastInterimRef.current = '';
          }
          setIsListening(false);
        }
      }, delay);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    stoppingRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  return {
    isListening,
    isConnected,
    transcript,
    finalTranscript,
    error,
    isSupported,
    start,
    stop,
  };
}
