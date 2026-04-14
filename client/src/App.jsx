import { Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import CartBar from './components/CartBar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ConditionsPage from './pages/ConditionsPage';
import CheckoutPage from './pages/CheckoutPage';
import ConfirmationPage from './pages/ConfirmationPage';
import AdminPage from './pages/AdminPage';
import AdminOrdersPage from './pages/AdminOrdersPage';
import AdminInventoryPage from './pages/AdminInventoryPage';
import AdminQuotesPage from './pages/AdminQuotesPage';
import AdminDebugQuotePage from './pages/AdminDebugQuotePage';
import AdminGatedItemsPage from './pages/AdminGatedItemsPage';
import BulkPage from './pages/BulkPage';
import TrackPage from './pages/TrackPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AccountPage from './pages/AccountPage';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <div className="min-h-screen flex flex-col bg-background">
          <Navbar />
          <main className="flex-1 pb-20">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/conditions" element={<ConditionsPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/confirmation/:orderId" element={<ConfirmationPage />} />
              <Route path="/bulk" element={<BulkPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/orders" element={<AdminOrdersPage />} />
              <Route path="/admin/inventory" element={<AdminInventoryPage />} />
              <Route path="/admin/quotes" element={<AdminQuotesPage />} />
              <Route path="/admin/debug-quote" element={<AdminDebugQuotePage />} />
              <Route path="/admin/gated-items" element={<AdminGatedItemsPage />} />
              <Route path="/track" element={<TrackPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/account" element={<AccountPage />} />
            </Routes>
          </main>
          <CartBar />
          <Footer />
        </div>
      </CartProvider>
    </AuthProvider>
  );
}
