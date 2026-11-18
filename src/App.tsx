import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { TenantProvider } from './context/TenantContext';
import { POSDataProvider } from './context/POSDataContext';

// Importar todas las páginas
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Orders from './pages/Orders';
import PointOfSale from './pages/PointOfSale';
import CashRegister from './pages/CashRegister';
import Customers from './pages/Customers';
import Tables from './pages/Tables';
import AcceptInvite from './pages/AcceptInvite';
import Categories from './pages/Categories';
import NewOrder from './pages/NewOrder';
import FiscalDocuments from './pages/FiscalDocuments';
import Brands from './pages/Brands';
import CashRegisterHistory from './pages/CashRegisterHistory';
import Settings from './pages/Settings';
import PaymentMethods from './pages/PaymentMethods';
import Personal from './pages/Personal';
import Inventory from './pages/Inventory';

// Import hook for tenant context
import { useTenant } from './context/TenantContext';
import { useLocation } from 'react-router-dom';

// Protected Route Component
const ProtectedRoute = () => {
  const { session, loading: authLoading } = useAuth();
  const { isFirstLogin, loading: tenantLoading } = useTenant();
  const location = useLocation();

  if (authLoading || tenantLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // If it's first login and not already on settings page, redirect to settings
  if (isFirstLogin && location.pathname !== '/settings') {
    return <Navigate to="/settings" replace />;
  }

  return <Outlet />;
};

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <TenantProvider>
            <POSDataProvider>
              <Router>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/accept-invite" element={<AcceptInvite />} />

                  {/* Protected Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/orders/new" element={<NewOrder />} />
                    <Route path="/pos" element={<PointOfSale />} />
                    <Route path="/tables" element={<Tables />} />
                    <Route path="/personal" element={<Personal />} />
                    <Route path="/fiscal-documents" element={<FiscalDocuments />} />
                    <Route path="/brands" element={<Brands />} />
                    <Route path="/cash-register" element={<CashRegister />} />
                    <Route path="/cash-register/history" element={<CashRegisterHistory />} />
                    <Route path="/payment-methods" element={<PaymentMethods />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Router>
            </POSDataProvider>
          </TenantProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
