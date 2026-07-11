import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import InvestigationFeed from '../components/InvestigationFeed';

describe('InvestigationFeed Component', () => {
  it('renders empty feed without crashing', () => {
    const { container } = render(<InvestigationFeed messages={[]} />);
    expect(container).toBeTruthy();
  });

  it('renders an event message', () => {
    const messages = [
      { id: 'm1', type: 'event', content: 'A clue was discovered.', timestamp: '10:00 PM' }
    ];
    render(<InvestigationFeed messages={messages} />);
    expect(screen.getByText('A clue was discovered.')).toBeInTheDocument();
    expect(screen.getByText('10:00 PM')).toBeInTheDocument();
  });

  it('renders a narrative message', () => {
    const messages = [
      { id: 'm2', type: 'narrative', content: '"The smell of roses lingered in the air..."' }
    ];
    render(<InvestigationFeed messages={messages} />);
    expect(screen.getByText('"The smell of roses lingered in the air..."')).toBeInTheDocument();
  });

  it('renders a player message with player name', () => {
    const messages = [
      { id: 'm3', type: 'player', sender: 'Alice', content: 'Where was everyone at midnight?', time: '10:05 PM' }
    ];
    render(<InvestigationFeed messages={messages} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Where was everyone at midnight?')).toBeInTheDocument();
  });

  it('renders a GM/answer message with GAME MASTER label', () => {
    const messages = [
      { id: 'm4', type: 'gm', content: 'The butler was in the library.', time: '10:07 PM' }
    ];
    render(<InvestigationFeed messages={messages} />);
    expect(screen.getByText('GAME MASTER')).toBeInTheDocument();
    expect(screen.getByText('The butler was in the library.')).toBeInTheDocument();
  });

  it('renders a clue message', () => {
    const messages = [
      { id: 'm5', type: 'clue', content: 'NEW EVIDENCE: Torn Velvet.', timestamp: '10:10 PM' }
    ];
    render(<InvestigationFeed messages={messages} />);
    expect(screen.getByText('NEW EVIDENCE: Torn Velvet.')).toBeInTheDocument();
  });

  it('renders a divider message', () => {
    const messages = [
      { id: 'm6', type: 'divider', content: 'The investigation begins', timestamp: '10:00 PM' }
    ];
    render(<InvestigationFeed messages={messages} />);
    expect(screen.getByText('The investigation begins')).toBeInTheDocument();
  });

  it('renders multiple messages in correct order', () => {
    const messages = [
      { id: 'm1', type: 'event', content: 'First event', timestamp: '10:00 PM' },
      { id: 'm2', type: 'narrative', content: 'A narrative follows' },
      { id: 'm3', type: 'player', sender: 'Bob', content: 'A player message', time: '10:02 PM' }
    ];
    render(<InvestigationFeed messages={messages} />);
    expect(screen.getByText('First event')).toBeInTheDocument();
    expect(screen.getByText('A narrative follows')).toBeInTheDocument();
    expect(screen.getByText('A player message')).toBeInTheDocument();
  });
});
