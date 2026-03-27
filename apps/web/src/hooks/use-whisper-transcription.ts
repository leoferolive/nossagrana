import { useState, useRef, useCallback, useEffect } from 'react';
import { BrowserWhisper } from 'browser-whisper';

function checkSupported(): boolean {
  return typeof WebAssembly !== 'undefined' && typeof Worker !== 'undefined';
}

export interface UseWhisperTranscriptionReturn {
  isSupported: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  isModelLoading: boolean;
  modelProgress: number;
  transcript: string;
  error: string | null;
  startRecording: () => void;
  stopRecording: () => void;
}

export function useWhisperTranscription(): UseWhisperTranscriptionReturn {
  const isSupported = checkSupported();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const whisperRef = useRef<BrowserWhisper | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const processAudio = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      if (!whisperRef.current) {
        whisperRef.current = new BrowserWhisper({
          model: 'whisper-tiny',
          language: 'pt',
        });
      }

      const stream = whisperRef.current.transcribe(file, {
        onProgress: (evt: { stage: string; progress: number }) => {
          if (evt.stage === 'loading') {
            setIsModelLoading(true);
            setModelProgress(Math.round(evt.progress * 100));
          } else {
            setIsModelLoading(false);
          }
        },
      });

      const segments = await stream.collect();
      const text = segments
        .map((s: { text: string }) => s.text)
        .join(' ')
        .trim();
      setTranscript(text);
    } catch {
      setError('transcription-failed');
    } finally {
      setIsProcessing(false);
      setIsModelLoading(false);
    }
  }, []);

  const startRecording = useCallback(() => {
    setError(null);
    setTranscript('');

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        chunksRef.current = [];

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        } catch {
          recorder = new MediaRecorder(stream);
        }

        recorder.ondataavailable = (e: BlobEvent) => {
          chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          const file = new File([blob], 'recording.webm', {
            type: blob.type,
          });

          // Stop stream tracks
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;

          processAudio(file);
        };

        recorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
      })
      .catch((err: DOMException) => {
        if (err.name === 'NotAllowedError') {
          setError('no-permission');
        } else {
          setError('not-supported');
        }
      });
  }, [processAudio]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    isSupported,
    isRecording,
    isProcessing,
    isModelLoading,
    modelProgress,
    transcript,
    error,
    startRecording,
    stopRecording,
  };
}
