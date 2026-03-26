import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useSpeechRecognition } from './use-speech-recognition.js';

class MockSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

describe('useSpeechRecognition', () => {
  let originalSpeechRecognition: unknown;
  let originalWebkitSpeechRecognition: unknown;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalSpeechRecognition = (window as Record<string, unknown>).SpeechRecognition;
    originalWebkitSpeechRecognition = (window as Record<string, unknown>).webkitSpeechRecognition;
  });

  afterEach(() => {
    if (originalSpeechRecognition !== undefined) {
      Object.defineProperty(window, 'SpeechRecognition', {
        value: originalSpeechRecognition,
        writable: true,
        configurable: true,
      });
    } else {
      delete (window as Record<string, unknown>).SpeechRecognition;
    }
    if (originalWebkitSpeechRecognition !== undefined) {
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        value: originalWebkitSpeechRecognition,
        writable: true,
        configurable: true,
      });
    } else {
      delete (window as Record<string, unknown>).webkitSpeechRecognition;
    }
  });

  it('isSupported false when API not available', () => {
    delete (window as Record<string, unknown>).SpeechRecognition;
    delete (window as Record<string, unknown>).webkitSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());

    expect(result.current.isSupported).toBe(false);
  });

  it('isSupported true when API available', () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      value: MockSpeechRecognition,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useSpeechRecognition());

    expect(result.current.isSupported).toBe(true);
  });

  it('start() sets isListening to true', () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      value: MockSpeechRecognition,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });

    expect(result.current.isListening).toBe(true);
  });

  it('stop() sets isListening to false', () => {
    let capturedInstance: MockSpeechRecognition | null = null;
    const CaptureMock = class extends MockSpeechRecognition {
      constructor() {
        super();
        capturedInstance = this;
      }
    };

    Object.defineProperty(window, 'SpeechRecognition', {
      value: CaptureMock,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });

    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.stop();
      // Simulate the browser firing onend after stop
      capturedInstance!.onend?.();
    });

    expect(result.current.isListening).toBe(false);
  });

  it('error "not-supported" when starting on unsupported browser', () => {
    delete (window as Record<string, unknown>).SpeechRecognition;
    delete (window as Record<string, unknown>).webkitSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });

    expect(result.current.error).toBe('not-supported');
    expect(result.current.isListening).toBe(false);
  });

  it('cleanup on unmount (abort called)', () => {
    let capturedInstance: MockSpeechRecognition | null = null;
    const CaptureMock = class extends MockSpeechRecognition {
      constructor() {
        super();
        capturedInstance = this;
      }
    };

    Object.defineProperty(window, 'SpeechRecognition', {
      value: CaptureMock,
      writable: true,
      configurable: true,
    });

    const { result, unmount } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });

    expect(capturedInstance).not.toBeNull();

    unmount();

    expect(capturedInstance!.abort).toHaveBeenCalled();
  });
});
