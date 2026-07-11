import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlayerCard from '../components/PlayerCard';

const basePlayer = {
  id: 'p1',
  name: 'Alice Carter',
  initials: 'AC',
  isMe: false,
  isHost: false,
  status: 'READY',
  micStatus: 'on',
};

describe('PlayerCard Component', () => {
  it('renders player name and initials', () => {
    render(<PlayerCard player={basePlayer} />);
    expect(screen.getByText('Alice Carter')).toBeInTheDocument();
    expect(screen.getByText('AC')).toBeInTheDocument();
  });

  it('shows HOST tag when player is host', () => {
    render(<PlayerCard player={{ ...basePlayer, isHost: true }} />);
    expect(screen.getByText('HOST')).toBeInTheDocument();
  });

  it('shows YOU tag when player is the current user', () => {
    render(<PlayerCard player={{ ...basePlayer, isMe: true }} />);
    expect(screen.getByText('YOU')).toBeInTheDocument();
  });

  it('shows HOST and YOU tags when player is both host and current user', () => {
    render(<PlayerCard player={{ ...basePlayer, isHost: true, isMe: true }} />);
    expect(screen.getByText('HOST')).toBeInTheDocument();
    expect(screen.getByText('YOU')).toBeInTheDocument();
  });

  it('renders status text correctly', () => {
    render(<PlayerCard player={basePlayer} />);
    expect(screen.getByText('READY')).toBeInTheDocument();
  });

  it('renders COMMUNICATING status with pulsing dot', () => {
    render(<PlayerCard player={{ ...basePlayer, status: 'COMMUNICATING' }} />);
    expect(screen.getByText('COMMUNICATING')).toBeInTheDocument();
  });

  it('does not show HOST tag when player is not host', () => {
    render(<PlayerCard player={basePlayer} />);
    expect(screen.queryByText('HOST')).not.toBeInTheDocument();
  });

  it('does not show YOU tag when player is not current user', () => {
    render(<PlayerCard player={basePlayer} />);
    expect(screen.queryByText('YOU')).not.toBeInTheDocument();
  });
});
