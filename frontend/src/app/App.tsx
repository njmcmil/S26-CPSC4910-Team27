import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { CartProvider } from '../auth/CartContext';
import { router } from './routes';

export function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
      <CartProvider>
    </AuthProvider>
  );
}
