import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminThemeProvider } from './context/AdminThemeContext';
import { Layout } from './components/layout/Layout';
import Home from './pages/Home';
import Books from './pages/Books';
import BookDetail from './pages/BookDetail';
import Authors from './pages/Authors';
import BulkOrders from './pages/BulkOrders';
import About from './pages/About';
import Contact from './pages/Contact';
import Support from './pages/Support';
import Faqs from './pages/Faqs';
import Shipping from './pages/Shipping';
import Returns from './pages/Returns';
import Legal from './pages/Legal';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Cookies from './pages/Cookies';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import NotFound from './pages/NotFound';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

import AccountLayout from './pages/account/AccountLayout';
import AccountOverview from './pages/account/AccountOverview';
import AccountProfile from './pages/account/AccountProfile';
import AccountAddresses from './pages/account/AccountAddresses';
import AccountOrders from './pages/account/AccountOrders';
import AccountOrderDetail from './pages/account/AccountOrderDetail';
import AccountWishlist from './pages/account/AccountWishlist';

import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBooks from './pages/admin/AdminBooks';
import AdminHero from './pages/admin/AdminHero';
import AdminAuthors from './pages/admin/AdminAuthors';
import AdminOrders from './pages/admin/AdminOrders';
import AdminBulkOrders from './pages/admin/AdminBulkOrders';
import AdminAuthorApplications from './pages/admin/AdminAuthorApplications';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPromotions from './pages/admin/AdminPromotions';
import AdminContent from './pages/admin/AdminContent';
import AdminReports from './pages/admin/AdminReports';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="books" element={<Books />} />
        <Route path="books/:slug" element={<BookDetail />} />
        <Route path="authors" element={<Authors />} />
        <Route path="bulk-orders" element={<BulkOrders />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="support" element={<Support />} />
        <Route path="faqs" element={<Faqs />} />
        <Route path="shipping" element={<Shipping />} />
        <Route path="returns" element={<Returns />} />
        <Route path="legal" element={<Legal />} />
        <Route path="legal/privacy" element={<Privacy />} />
        <Route path="legal/terms" element={<Terms />} />
        <Route path="legal/cookies" element={<Cookies />} />
        <Route path="cart" element={<Cart />} />

        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />

        <Route
          path="checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />
        <Route
          path="checkout/confirmation/:id"
          element={
            <ProtectedRoute>
              <OrderConfirmation />
            </ProtectedRoute>
          }
        />

        <Route
          path="account"
          element={
            <ProtectedRoute>
              <AccountLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AccountOverview />} />
          <Route path="profile" element={<AccountProfile />} />
          <Route path="addresses" element={<AccountAddresses />} />
          <Route path="orders" element={<AccountOrders />} />
          <Route path="orders/:id" element={<AccountOrderDetail />} />
          <Route path="wishlist" element={<AccountWishlist />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      <Route
        path="admin"
        element={
          <ProtectedRoute roles={['STAFF', 'ADMIN']}>
            <AdminThemeProvider>
              <AdminLayout />
            </AdminThemeProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="books" element={<AdminBooks />} />
        <Route path="hero" element={<AdminHero />} />
        <Route path="authors" element={<AdminAuthors />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="bulk-orders" element={<AdminBulkOrders />} />
        <Route path="author-applications" element={<AdminAuthorApplications />} />
        <Route path="content" element={<AdminContent />} />
        <Route
          path="users"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="promotions"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminPromotions />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminReports />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
