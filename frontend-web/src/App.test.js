import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Navigate: () => null,
  Routes: ({ children }) => <div>{children}</div>,
  Route: ({ path, element }) => (path === '/' ? <div>{element}</div> : null),
  useNavigate: () => jest.fn(),
}), { virtual: true });

test('renders kiosk home actions', () => {
  render(<App />);
  expect(screen.getByText('물품보관함')).toBeInTheDocument();
  expect(screen.getByText('쉬운화면')).toBeInTheDocument();
});
