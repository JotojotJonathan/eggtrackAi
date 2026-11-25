import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';

import AdminLayout from './layouts/AdminLayout';
import UserLayout from './layouts/UserLayout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Worker from './pages/Worker';
import Buyer from './pages/Buyer';
import Delivery from './pages/Delivery';
import Profile from './pages/Profile';
import BuyerTracking from './pages/BuyerTracking';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminBuyers from './pages/admin/AdminBuyers';
import AdminAlerts from './pages/admin/AdminAlerts';
import AdminProduction from './pages/admin/AdminProduction';
import AdminDeliveries from './pages/admin/AdminDeliveries';
import AdminAIForecast from './pages/admin/AdminAIForecast';
import AdminMapTracker from './pages/admin/AdminMapTracker';
import AdminUsers from './pages/admin/AdminUsers';
import AdminReports from './pages/admin/AdminReports';
import AdminInventory from './pages/admin/AdminInventory';
import AdminRatings from './pages/admin/AdminRatings';
import Register from './pages/Register';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

            <Route element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
              <Route path="/profile" element={<Profile />} />
              <Route path="/tracking" element={<BuyerTracking />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['WORKER', 'ADMIN']}><UserLayout /></ProtectedRoute>}>
              <Route path="/worker" element={<Worker />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['BUYER', 'ADMIN']}><UserLayout /></ProtectedRoute>}>
              <Route path="/buyer" element={<Buyer />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['DELIVERY', 'ADMIN']}><UserLayout /></ProtectedRoute>}>
              <Route path="/delivery" element={<Delivery />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminLayout /></ProtectedRoute>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/production" element={<AdminProduction />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/buyers" element={<AdminBuyers />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/deliveries" element={<AdminDeliveries />} />
              <Route path="/admin/alerts" element={<AdminAlerts />} />
              <Route path="/admin/forecast" element={<AdminAIForecast />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/inventory" element={<AdminInventory />} />
              <Route path="/admin/map" element={<AdminMapTracker />} />
              <Route path="/admin/ratings" element={<AdminRatings />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;