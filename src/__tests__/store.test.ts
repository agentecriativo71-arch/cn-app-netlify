import { describe, it, expect, beforeEach } from 'vitest';
import { useLook } from '../lib/store';

describe('useLook Store - Tecido por SKU', () => {
  beforeEach(() => {
    useLook.getState().reset();
  });

  it('deve ter campos de tecido nulos por padrão', () => {
    const s = useLook.getState();
    expect(s.tecidoSku).toBeNull();
    expect(s.tecidoNome).toBeNull();
    expect(s.tecidoImageUrl).toBeNull();
    expect(s.tecidoPantone).toBeNull();
  });

  it('deve atualizar campos de tecido corretamente ao selecionar um SKU', () => {
    useLook.getState().set({
      tecidoSku: 'TEC-1234',
      tecidoNome: 'Seda Pura Verde',
      tecidoImageUrl: 'https://exemplo.com/tecido.jpg',
      tecidoPantone: '17-6153 TCX',
      cor: null,
    });

    const s = useLook.getState();
    expect(s.tecidoSku).toBe('TEC-1234');
    expect(s.tecidoNome).toBe('Seda Pura Verde');
    expect(s.tecidoImageUrl).toBe('https://exemplo.com/tecido.jpg');
    expect(s.tecidoPantone).toBe('17-6153 TCX');
    expect(s.cor).toBeNull();
  });

  it('deve limpar campos de tecido e restaurar estado inicial ao fazer reset', () => {
    useLook.getState().set({
      tecidoSku: 'TEC-5678',
      tecidoNome: 'Linho Rústico',
      tecidoImageUrl: 'https://exemplo.com/linho.jpg',
    });

    useLook.getState().reset();

    const s = useLook.getState();
    expect(s.tecidoSku).toBeNull();
    expect(s.tecidoNome).toBeNull();
    expect(s.tecidoImageUrl).toBeNull();
  });
});
