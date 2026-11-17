import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useViewportVisivel } from './use-viewport-visivel';

class FakeVisualViewport extends EventTarget {
  height = 800;
  offsetTop = 0;
}

const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');

afterEach(() => {
  if (original) Object.defineProperty(window, 'visualViewport', original);
  else Reflect.deleteProperty(window, 'visualViewport');
});

describe('useViewportVisivel', () => {
  it('sem visualViewport (jsdom, navegador antigo) devolve null', () => {
    const { result } = renderHook(() => useViewportVisivel());
    expect(result.current).toBeNull();
  });

  it('devolve a área visível e acompanha o teclado abrindo e fechando', () => {
    const fake = new FakeVisualViewport();
    Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
    const { result } = renderHook(() => useViewportVisivel());
    expect(result.current).toEqual({ top: 0, height: 800 });

    act(() => {
      fake.height = 480;
      fake.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toEqual({ top: 0, height: 480 });
  });

  it('para de ouvir quando o componente sai', () => {
    const fake = new FakeVisualViewport();
    Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
    const { result, unmount } = renderHook(() => useViewportVisivel());
    unmount();
    fake.height = 100;
    fake.dispatchEvent(new Event('resize'));
    expect(result.current).toEqual({ top: 0, height: 800 });
  });
});
