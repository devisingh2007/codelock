import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EvidenceCard from '../components/EvidenceCard';

describe('EvidenceCard Component', () => {
  it('renders locked evidence with ??? label', () => {
    const evidence = { id: 'e1', name: 'Secret Evidence', status: 'locked', icon: 'lock' };
    render(<EvidenceCard evidence={evidence} onClick={() => {}} />);
    expect(screen.getByText('???')).toBeInTheDocument();
    // Should NOT render the actual name for locked evidence
    expect(screen.queryByText('Secret Evidence')).not.toBeInTheDocument();
  });

  it('renders revealed evidence with name', () => {
    const evidence = { id: 'e2', name: 'Torn Velvet', status: 'revealed', icon: 'document' };
    render(<EvidenceCard evidence={evidence} onClick={() => {}} />);
    expect(screen.getByText('Torn Velvet')).toBeInTheDocument();
  });

  it('calls onClick when revealed evidence card is clicked', () => {
    const handleClick = vi.fn();
    const evidence = { id: 'e3', name: 'Shattered Glass', status: 'revealed', icon: 'sample' };
    render(<EvidenceCard evidence={evidence} onClick={handleClick} />);
    
    fireEvent.click(screen.getByText('Shattered Glass'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClick when locked evidence card is clicked', () => {
    const handleClick = vi.fn();
    const evidence = { id: 'e4', name: 'Mystery Item', status: 'locked', icon: 'lock' };
    render(<EvidenceCard evidence={evidence} onClick={handleClick} />);
    
    // The locked card renders ??? not the name, so click the ??? text
    fireEvent.click(screen.getByText('???'));
    // Locked cards don't have onClick attached
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('handles unknown icon type with fallback to FileText icon', () => {
    const evidence = { id: 'e5', name: 'Unknown Evidence', status: 'revealed', icon: 'unknown_icon_type' };
    // Should not crash - falls back to FileText icon
    const { container } = render(<EvidenceCard evidence={evidence} onClick={() => {}} />);
    expect(screen.getByText('Unknown Evidence')).toBeInTheDocument();
    expect(container).toBeTruthy();
  });
});
