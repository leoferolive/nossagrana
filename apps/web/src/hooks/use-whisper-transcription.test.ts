import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCollect = vi.fn();
const mockTranscribe = vi.fn(
  (_file?: File, _opts?: { onProgress?: (evt: { stage: string; progress: number }) => void }) => ({
    collect: mockCollect,
  }),
);

vi.mock('browser-whisper', () => ({
  BrowserWhisper: vi.fn().mockImplementation(() => ({
    transcribe: mockTranscribe,
  })),
}));

import { useWhisperTranscription } from './use-whisper-transcription.js';

// Mock MediaRecorder that defers onstop to allow async act wrapping
class MockMediaRecorder {
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start = vi.fn(() => {
    this.state = 'recording';
  });

  stop = vi.fn(() => {
    this.state = 'inactive';
    // Use microtask to allow act() to wrap the async processAudio
    Promise.resolve().then(() => {
      this.ondataavailable?.({ data: new Blob(['audio-data'], { type: 'audio/webm' }) });
      this.onstop?.();
    });
  });

  static isTypeSupported = vi.fn(() => true);
}

const mockTrackStop = vi.fn();
const mockGetUserMedia = vi.fn();

describe('useWhisperTranscription', () => {
  let originalWorker: typeof globalThis.Worker | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCollect.mockResolvedValue([{ text: 'gastei cinquenta no mercado', start: 0, end: 1 }]);
    mockTranscribe.mockReturnValue({ collect: mockCollect });
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: mockTrackStop }],
    });
    mockTrackStop.mockClear();

    // Ensure Worker is available for isSupported check
    originalWorker = globalThis.Worker;
    if (typeof globalThis.Worker === 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-extraneous-class
      (globalThis as Record<string, unknown>).Worker = class MockWorker {};
    }

    Object.defineProperty(global, 'MediaRecorder', {
      value: MockMediaRecorder,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalWorker === undefined) {
      delete (globalThis as Record<string, unknown>).Worker;
    } else {
      globalThis.Worker = originalWorker;
    }
  });

  it('isSupported true when WebAssembly and Worker available', () => {
    const { result } = renderHook(() => useWhisperTranscription());
    expect(result.current.isSupported).toBe(true);
  });

  it('startRecording sets isRecording to true and calls getUserMedia', async () => {
    const { result } = renderHook(() => useWhisperTranscription());

    await act(async () => {
      result.current.startRecording();
    });

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });

    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it('stopRecording triggers transcription and fills transcript', async () => {
    const { result } = renderHook(() => useWhisperTranscription());

    // Start recording
    await act(async () => {
      result.current.startRecording();
    });

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });

    // Stop recording - triggers transcription via microtask
    await act(async () => {
      result.current.stopRecording();
      // Flush microtask + async processAudio
      await new Promise((r) => setTimeout(r, 0));
    });

    // Wait for transcription to complete
    await waitFor(() => {
      expect(result.current.transcript).toBe('gastei cinquenta no mercado');
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isProcessing).toBe(false);
  });

  it('getUserMedia denied sets error to no-permission', async () => {
    const permissionError = new DOMException('Permission denied', 'NotAllowedError');
    mockGetUserMedia.mockRejectedValueOnce(permissionError);

    const { result } = renderHook(() => useWhisperTranscription());

    await act(async () => {
      result.current.startRecording();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('no-permission');
    });
    expect(result.current.isRecording).toBe(false);
  });

  it('transcription failure sets error to transcription-failed', async () => {
    mockCollect.mockRejectedValueOnce(new Error('Whisper failed'));

    const { result } = renderHook(() => useWhisperTranscription());

    await act(async () => {
      result.current.startRecording();
    });

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });

    await act(async () => {
      result.current.stopRecording();
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => {
      expect(result.current.error).toBe('transcription-failed');
    });
    expect(result.current.isProcessing).toBe(false);
  });

  it('model progress callback updates during loading stage', async () => {
    let capturedOnProgress: ((evt: { stage: string; progress: number }) => void) | undefined;
    mockTranscribe.mockImplementation(
      (
        _file?: File,
        opts?: { onProgress?: (evt: { stage: string; progress: number }) => void },
      ) => {
        capturedOnProgress = opts?.onProgress;
        return { collect: mockCollect };
      },
    );
    mockCollect.mockImplementation(async () => {
      capturedOnProgress?.({ stage: 'loading', progress: 0.5 });
      capturedOnProgress?.({ stage: 'decoding', progress: 0.8 });
      return [{ text: 'teste', start: 0, end: 1 }];
    });

    const { result } = renderHook(() => useWhisperTranscription());

    await act(async () => {
      result.current.startRecording();
    });

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });

    await act(async () => {
      result.current.stopRecording();
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => {
      expect(result.current.transcript).toBe('teste');
    });
    expect(result.current.isModelLoading).toBe(false);
  });

  it('cleanup stops stream tracks on unmount', async () => {
    const { result, unmount } = renderHook(() => useWhisperTranscription());

    await act(async () => {
      result.current.startRecording();
    });

    await waitFor(() => {
      expect(result.current.isRecording).toBe(true);
    });

    unmount();

    expect(mockTrackStop).toHaveBeenCalled();
  });
});
