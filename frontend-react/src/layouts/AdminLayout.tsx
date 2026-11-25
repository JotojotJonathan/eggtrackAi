import { useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';


const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/production', label: 'Production', icon: '🥚' },
    { path: '/admin/inventory', label: 'Inventory', icon: '📦' },
    { path: '/admin/orders', label: 'Orders', icon: '📋' },
    { path: '/admin/buyers', label: 'Buyers', icon: '👥' },
    { path: '/admin/users', label: 'Users', icon: '👤' },
    { path: '/admin/deliveries', label: 'Deliveries', icon: '🚚' },
    { path: '/admin/alerts', label: 'Alerts', icon: '🔔' },
    { path: '/admin/forecast', label: 'AI Forecast', icon: '🔮' },
    { path: '/admin/reports', label: 'Reports', icon: '📈' },
    { path: '/admin/map', label: 'Delivery Map', icon: '🗺️' },
    { path: '/admin/ratings', label: 'Ratings', icon: '⭐' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden bg-green-700 dark:bg-green-900 text-white p-4 flex justify-between items-center sticky top-0 z-40">
        <h1 className="text-xl font-bold">🥚 EggTrack Admin</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="p-2 rounded hover:bg-white/20 transition text-xl"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? '☀️' : '🌙'}
          </button>
          <NotificationBell />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white text-2xl focus:outline-none"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen w-64 bg-green-800 dark:bg-green-950 text-white z-50
          transform transition-transform duration-300
          flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-green-700 dark:border-green-800 flex-shrink-0">
          <h1 className="text-lg font-bold hidden lg:block">🥚 EggTrack AI</h1>
          <p className="text-xs text-green-300 mt-1">Admin Dashboard</p>
        </div>

        {/* Scrollable Nav */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 sidebar-scroll">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                location.pathname === item.path
                  ? 'bg-green-600 dark:bg-green-700'
                  : 'hover:bg-green-700 dark:hover:bg-green-800'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User Info + Logout */}
        <div className="p-4 border-t border-green-700 dark:border-green-800 flex-shrink-0">
          <div className="text-sm mb-2 truncate">👤 {user?.username}</div>
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Bar with Bell */}
        <div className="hidden lg:flex bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 px-6 py-3 justify-end items-center gap-3 sticky top-0 z-30">
          <button
            onClick={toggle}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition text-xl"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? '☀️' : '🌙'}
          </button>
          <NotificationBell />
        </div>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;