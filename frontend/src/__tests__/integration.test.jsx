import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket.io-client
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

// Mock gameApi to prevent real API calls from crashing
vi.mock('../api/gameApi', () => ({
  getLobbyState: vi.fn().mockResolvedValue({ players: [], caseInfo: { name: 'Test Case', number: '001' } }),
  getEvidence: vi.fn().mockResolvedValue([]),
  getTimeline: vi.fn().mockResolvedValue([]),
  getGameState: vi.fn().mockResolvedValue({ phase: 'investigation', story: { location: 'The Study' } }),
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
  sendMessage: vi.fn().mockResolvedValue({ id: '1', sender: 'You', content: 'Test', type: 'player' }),
  getSocket: vi.fn().mockReturnValue(null),
}));

import TopNavBar from '../components/TopNavBar';
import PlayerCard from '../components/PlayerCard';

describe('TopNavBar', () => {
  it('renders nav links', () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>
    );
    expect(screen.getByText('MIDNIGHT MURDER')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});

describe('PlayerCard Integration', () => {
  it('renders a complete player card with all badges', () => {
    const player = {
      id: 'p1',
      name: 'Detective Morgan',
      initials: 'DM',
      isMe: true,
      isHost: true,
      status: 'READY',
      micStatus: 'on',
    };
    render(<PlayerCard player={player} />);
    expect(screen.getByText('Detective Morgan')).toBeInTheDocument();
    expect(screen.getByText('DM')).toBeInTheDocument();
    expect(screen.getByText('HOST')).toBeInTheDocument();
    expect(screen.getByText('YOU')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
  });

  it('renders an eliminated player card', () => {
    const player = {
      id: 'p2',
      name: 'Victor Vance',
      initials: 'VV',
      isMe: false,
      isHost: false,
      status: 'ELIMINATED',
      micStatus: 'off',
    };
    const { container } = render(<PlayerCard player={player} />);
    expect(screen.getByText('ELIMINATED')).toBeInTheDocument();
    // The card should have 'eliminated' class applied
    expect(container.querySelector('[class*="eliminated"]')).toBeTruthy();
  });
});
