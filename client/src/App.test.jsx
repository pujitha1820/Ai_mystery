import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

describe('landing page', () => {
  it('introduces the mystery game and offers a path to create a case', () => {
    render(<BrowserRouter><App /></BrowserRouter>);
    expect(screen.getByRole('heading', { name: /every mystery has a secret/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /create your mystery/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/entirely fictional cases/i)).toBeInTheDocument();
  });
  it('keeps case submission disabled until the scenario meets the minimum length', async () => {
    window.history.pushState({}, '', '/create');
    render(<BrowserRouter><App /></BrowserRouter>);
    const submit = screen.getByRole('button', { name: /build my case/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/your scenario/i), { target: { value: 'A fictional disappearance at a remote hotel.' } });
    expect(submit).toBeEnabled();
  });
});
