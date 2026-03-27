import { describe, it, expect } from 'vitest';

import { matchCategory } from './category-matcher';

const CATEGORIAS = [
  { id: 'cat-1', nome: 'Alimentação' },
  { id: 'cat-2', nome: 'Transporte' },
  { id: 'cat-3', nome: 'Moradia' },
  { id: 'cat-4', nome: 'Saúde' },
  { id: 'cat-5', nome: 'Lazer' },
];

describe('matchCategory', () => {
  describe('keyword matching (high confidence)', () => {
    it('should match "mercado" to Alimentação', () => {
      const result = matchCategory('mercado', CATEGORIAS);
      expect(result).toEqual({ categoriaId: 'cat-1', confidence: 'high' });
    });

    it('should match "uber" to Transporte', () => {
      const result = matchCategory('uber', CATEGORIAS);
      expect(result).toEqual({ categoriaId: 'cat-2', confidence: 'high' });
    });

    it('should match "aluguel" to Moradia', () => {
      const result = matchCategory('aluguel', CATEGORIAS);
      expect(result).toEqual({ categoriaId: 'cat-3', confidence: 'high' });
    });

    it('should match "farmácia" to Saúde', () => {
      const result = matchCategory('farmácia', CATEGORIAS);
      expect(result).toEqual({ categoriaId: 'cat-4', confidence: 'high' });
    });

    it('should match "cinema" to Lazer', () => {
      const result = matchCategory('cinema', CATEGORIAS);
      expect(result).toEqual({ categoriaId: 'cat-5', confidence: 'high' });
    });

    it('should be case-insensitive: "MERCADO" matches Alimentação', () => {
      const result = matchCategory('MERCADO', CATEGORIAS);
      expect(result).toEqual({ categoriaId: 'cat-1', confidence: 'high' });
    });

    it('should match "farmacia" (no accent) via keyword dictionary', () => {
      const result = matchCategory('farmacia', CATEGORIAS);
      expect(result).toEqual({ categoriaId: 'cat-4', confidence: 'high' });
    });

    it('should match multi-word keyword "conta de luz" to Moradia', () => {
      const result = matchCategory('conta de luz', CATEGORIAS);
      expect(result).toEqual({ categoriaId: 'cat-3', confidence: 'high' });
    });
  });

  describe('keyword found but category not in family', () => {
    it('should return null when keyword category is not in family list', () => {
      const categorias = [{ id: 'cat-99', nome: 'Outros' }];
      const result = matchCategory('mercado', categorias);
      expect(result).toBeNull();
    });
  });

  describe('fuzzy matching (medium confidence)', () => {
    it('should fuzzy match "alimentaçao" (wrong accent) to Alimentação', () => {
      const result = matchCategory('alimentaçao', CATEGORIAS);
      expect(result).not.toBeNull();
      expect(result!.categoriaId).toBe('cat-1');
      expect(result!.confidence).toBe('medium');
    });
  });

  describe('no match', () => {
    it('should return null for "xyz123"', () => {
      const result = matchCategory('xyz123', CATEGORIAS);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should return null for empty description', () => {
      const result = matchCategory('', CATEGORIAS);
      expect(result).toBeNull();
    });

    it('should return null for empty categories list', () => {
      const result = matchCategory('mercado', []);
      expect(result).toBeNull();
    });
  });
});
