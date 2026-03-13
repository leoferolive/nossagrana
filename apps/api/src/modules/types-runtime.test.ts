import { describe, expect, it } from 'vitest';

describe('types modules runtime', () => {
  it('loads auth/categoria/familia types modules', async () => {
    const authTypesModule = await import('./auth/auth.types.js');
    const categoriaTypesModule = await import('./categoria/categoria.types.js');
    const familiaTypesModule = await import('./familia/familia.types.js');

    expect(authTypesModule).toBeDefined();
    expect(categoriaTypesModule).toBeDefined();
    expect(familiaTypesModule).toBeDefined();
    expect(authTypesModule.authTypesRuntimeMarker).toBe(true);
    expect(categoriaTypesModule.categoriaTypesRuntimeMarker).toBe(true);
    expect(familiaTypesModule.familiaTypesRuntimeMarker).toBe(true);
  });
});
