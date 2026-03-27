import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { parseVoiceInput } from './voice-parser';

describe('parseVoiceInput', () => {
  // Fix "today" for deterministic date tests
  const FIXED_DATE = new Date('2026-03-26T12:00:00');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('tipo extraction', () => {
    it('should detect despesa from "gastei"', () => {
      const result = parseVoiceInput('gastei 50 reais');
      expect(result.tipo).toBe('despesa');
    });

    it('should detect despesa from "paguei"', () => {
      const result = parseVoiceInput('paguei 200 de conta');
      expect(result.tipo).toBe('despesa');
    });

    it('should detect despesa from "comprei"', () => {
      const result = parseVoiceInput('comprei um lanche');
      expect(result.tipo).toBe('despesa');
    });

    it('should detect despesa from "gastar"', () => {
      const result = parseVoiceInput('gastar 100 reais');
      expect(result.tipo).toBe('despesa');
    });

    it('should detect despesa from "pagar"', () => {
      const result = parseVoiceInput('pagar conta de luz');
      expect(result.tipo).toBe('despesa');
    });

    it('should detect despesa from "comprar"', () => {
      const result = parseVoiceInput('comprar pao');
      expect(result.tipo).toBe('despesa');
    });

    it('should detect despesa from "despesa"', () => {
      const result = parseVoiceInput('despesa de mercado');
      expect(result.tipo).toBe('despesa');
    });

    it('should detect receita from "recebi"', () => {
      const result = parseVoiceInput('recebi 1000 reais');
      expect(result.tipo).toBe('receita');
    });

    it('should detect receita from "ganhei"', () => {
      const result = parseVoiceInput('ganhei 500 reais');
      expect(result.tipo).toBe('receita');
    });

    it('should detect receita from "receber"', () => {
      const result = parseVoiceInput('receber pagamento');
      expect(result.tipo).toBe('receita');
    });

    it('should detect receita from "ganhar"', () => {
      const result = parseVoiceInput('ganhar bonus');
      expect(result.tipo).toBe('receita');
    });

    it('should detect receita from "receita"', () => {
      const result = parseVoiceInput('receita freelance');
      expect(result.tipo).toBe('receita');
    });

    it('should detect receita from "salário"', () => {
      const result = parseVoiceInput('salário do mês');
      expect(result.tipo).toBe('receita');
    });

    it('should detect receita from "freelance"', () => {
      const result = parseVoiceInput('freelance 200 reais');
      expect(result.tipo).toBe('receita');
    });

    it('should return null when no keyword matches', () => {
      const result = parseVoiceInput('mercado 50 reais');
      expect(result.tipo).toBeNull();
    });
  });

  describe('valor extraction', () => {
    it('should extract "50 reais" as "50.00"', () => {
      const result = parseVoiceInput('gastei 50 reais');
      expect(result.valor).toBe('50.00');
    });

    it('should extract "R$ 100" as "100.00"', () => {
      const result = parseVoiceInput('gastei R$ 100');
      expect(result.valor).toBe('100.00');
    });

    it('should extract "35 e 90" as "35.90"', () => {
      const result = parseVoiceInput('gastei 35 e 90');
      expect(result.valor).toBe('35.90');
    });

    it('should extract "12,90" as "12.90"', () => {
      const result = parseVoiceInput('gastei 12,90');
      expect(result.valor).toBe('12.90');
    });

    it('should extract standalone number "42" as "42.00"', () => {
      const result = parseVoiceInput('gastei 42');
      expect(result.valor).toBe('42.00');
    });

    it('should extract "cinquenta" as "50.00"', () => {
      const result = parseVoiceInput('gastei cinquenta reais');
      expect(result.valor).toBe('50.00');
    });

    it('should extract "cem" as "100.00"', () => {
      const result = parseVoiceInput('gastei cem reais');
      expect(result.valor).toBe('100.00');
    });

    it('should extract "duzentos" as "200.00"', () => {
      const result = parseVoiceInput('gastei duzentos reais');
      expect(result.valor).toBe('200.00');
    });

    it('should extract "mil" as "1000.00"', () => {
      const result = parseVoiceInput('gastei mil reais');
      expect(result.valor).toBe('1000.00');
    });

    it('should return null when no value found', () => {
      const result = parseVoiceInput('gastei no mercado');
      expect(result.valor).toBeNull();
    });

    it('should extract "R$ 123,45" as "123.45"', () => {
      const result = parseVoiceInput('gastei R$ 123,45');
      expect(result.valor).toBe('123.45');
    });

    it('should extract "123.45" as "123.45"', () => {
      const result = parseVoiceInput('gastei 123.45 no mercado');
      expect(result.valor).toBe('123.45');
    });

    it('should not match "um" inside "algum"', () => {
      const result = parseVoiceInput('gastei algum dinheiro');
      expect(result.valor).toBeNull();
    });
  });

  describe('data extraction', () => {
    it('should extract "hoje" as today', () => {
      const result = parseVoiceInput('gastei 50 reais hoje');
      expect(result.data).toBe('2026-03-26');
    });

    it('should extract "ontem" as yesterday', () => {
      const result = parseVoiceInput('gastei 50 reais ontem');
      expect(result.data).toBe('2026-03-25');
    });

    it('should extract "anteontem" as day before yesterday', () => {
      const result = parseVoiceInput('gastei 50 reais anteontem');
      expect(result.data).toBe('2026-03-24');
    });

    it('should extract weekday name to last occurrence', () => {
      // 2026-03-26 is Thursday. "segunda" (Monday) = 2026-03-23
      const result = parseVoiceInput('gastei 50 reais segunda');
      expect(result.data).toBe('2026-03-23');
    });

    it('should extract "terça" to last Tuesday', () => {
      // 2026-03-26 is Thursday. "terça" (Tuesday) = 2026-03-24
      const result = parseVoiceInput('gastei 50 reais terça');
      expect(result.data).toBe('2026-03-24');
    });

    it('should extract "quarta" to last Wednesday', () => {
      // 2026-03-26 is Thursday. "quarta" (Wednesday) = 2026-03-25
      const result = parseVoiceInput('gastei 50 reais quarta');
      expect(result.data).toBe('2026-03-25');
    });

    it('should extract "sexta" to last Friday', () => {
      // 2026-03-26 is Thursday. "sexta" (Friday) = 2026-03-20
      const result = parseVoiceInput('gastei 50 reais sexta');
      expect(result.data).toBe('2026-03-20');
    });

    it('should extract "sábado" to last Saturday', () => {
      // 2026-03-26 is Thursday. "sábado" (Saturday) = 2026-03-21
      const result = parseVoiceInput('gastei 50 reais sábado');
      expect(result.data).toBe('2026-03-21');
    });

    it('should extract "domingo" to last Sunday', () => {
      // 2026-03-26 is Thursday. "domingo" (Sunday) = 2026-03-22
      const result = parseVoiceInput('gastei 50 reais domingo');
      expect(result.data).toBe('2026-03-22');
    });

    it('should return null when no date keyword found', () => {
      const result = parseVoiceInput('gastei 50 reais no mercado');
      expect(result.data).toBeNull();
    });

    it('should check "anteontem" before "ontem" to avoid substring match', () => {
      const result = parseVoiceInput('gastei 50 reais anteontem');
      // Should be -2 days, not -1
      expect(result.data).toBe('2026-03-24');
    });
  });

  describe('descricao extraction', () => {
    it('should extract "mercado" from "gastei 50 reais no mercado ontem"', () => {
      const result = parseVoiceInput('gastei 50 reais no mercado ontem');
      expect(result.descricao).toBe('mercado');
    });

    it('should extract "conta de luz" from "paguei 200 de conta de luz"', () => {
      const result = parseVoiceInput('paguei 200 de conta de luz');
      expect(result.descricao).toBe('conta luz');
    });

    it('should extract "uber" from "uber 25 reais"', () => {
      const result = parseVoiceInput('uber 25 reais');
      expect(result.descricao).toBe('uber');
    });

    it('should return null when nothing remains', () => {
      const result = parseVoiceInput('gastei 50 reais');
      expect(result.descricao).toBeNull();
    });
  });

  describe('full phrases (integration)', () => {
    it('should parse "gastei 50 reais no mercado ontem"', () => {
      const result = parseVoiceInput('gastei 50 reais no mercado ontem');
      expect(result).toEqual({
        tipo: 'despesa',
        valor: '50.00',
        descricao: 'mercado',
        data: '2026-03-25',
      });
    });

    it('should parse "paguei R$ 123,45 de conta de luz hoje"', () => {
      const result = parseVoiceInput('paguei R$ 123,45 de conta de luz hoje');
      expect(result).toEqual({
        tipo: 'despesa',
        valor: '123.45',
        descricao: 'conta luz',
        data: '2026-03-26',
      });
    });

    it('should parse "recebi 1000 reais de salário"', () => {
      const result = parseVoiceInput('recebi 1000 reais de salário');
      expect(result).toEqual({
        tipo: 'receita',
        valor: '1000.00',
        descricao: null,
        data: null,
      });
    });

    it('should parse "comprei pão por cinquenta reais"', () => {
      const result = parseVoiceInput('comprei pão por cinquenta reais');
      expect(result).toEqual({
        tipo: 'despesa',
        valor: '50.00',
        descricao: 'pão',
        data: null,
      });
    });

    it('should return all nulls for empty string', () => {
      const result = parseVoiceInput('');
      expect(result).toEqual({
        tipo: null,
        valor: null,
        descricao: null,
        data: null,
      });
    });

    it('should parse "uber 25 reais ontem"', () => {
      const result = parseVoiceInput('uber 25 reais ontem');
      expect(result).toEqual({
        tipo: null,
        valor: '25.00',
        descricao: 'uber',
        data: '2026-03-25',
      });
    });

    it('should parse "é gastei 100 BRL no mercado" (filler + BRL)', () => {
      const result = parseVoiceInput('é gastei 100 BRL no mercado');
      expect(result.tipo).toBe('despesa');
      expect(result.valor).toBe('100.00');
      expect(result.descricao).toBe('mercado');
    });

    it('should strip filler words from description', () => {
      const result = parseVoiceInput('é, gastei 50 reais no mercado');
      expect(result.descricao).toBe('mercado');
    });

    it('should handle "100 brl" as currency', () => {
      const result = parseVoiceInput('paguei 100 brl de luz');
      expect(result.valor).toBe('100.00');
      expect(result.descricao).toBe('luz');
    });
  });
});
