import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import { describe, it, expect } from 'vitest';

describe('TopNavBar Component', () => {
  it('renders the brand title correctly', () => {
    render(
      <BrowserRouter>
        <TopNavBar />
      </BrowserRouter>
    );
    
    // Check if the logo/text is rendered
    expect(screen.getByText('MIDNIGHT MURDER')).toBeInTheDocument();
  });
});
