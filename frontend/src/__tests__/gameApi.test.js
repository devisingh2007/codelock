import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket.io-client at the top level before any imports
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    off: vi.fn(),
  })),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('gameApi - autoAuthenticate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('stores token in localStorage on successful registration', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'fake-token-123' }),
    });

    const { autoAuthenticate } = await import('../api/gameApi');
    const token = await autoAuthenticate('TestPlayer');
    
    expect(token).toBe('fake-token-123');
    expect(localStorage.getItem('token')).toBe('fake-token-123');
    expect(localStorage.getItem('username')).toBe('TestPlayer');
  });

  it('falls back to login when registration fails', async () => {
    // First call (register) fails
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'User already exists.' }),
      })
      // Second call (login) succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'login-token-456' }),
      });

    const { autoAuthenticate } = await import('../api/gameApi');
    const token = await autoAuthenticate('ExistingPlayer');
    
    expect(token).toBe('login-token-456');
    expect(localStorage.getItem('token')).toBe('login-token-456');
  });
});

describe('gameApi - sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a message object with correct content', async () => {
    const { sendMessage } = await import('../api/gameApi');
    const msg = await sendMessage('ABCD12', 'Hello team!');
    
    expect(msg).toMatchObject({
      sender: 'You',
      type: 'player',
      content: 'Hello team!',
    });
    expect(msg.id).toBeDefined();
  });
});
