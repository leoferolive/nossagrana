import { describe, expect, it, vi } from 'vitest';

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));
const registerSWMock = vi.fn();

vi.mock('react-dom/client', () => ({
  createRoot: createRootMock,
}));

vi.mock('virtual:pwa-register', () => ({
  registerSW: registerSWMock,
}));

describe('main', () => {
  it('registers service worker and mounts app root', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await import('./main');

    expect(registerSWMock).toHaveBeenCalledWith({ immediate: true });
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'));
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
