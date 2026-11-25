import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';

const UserLayout = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Top Navbar */}
      <nav className="bg-green-700 dark:bg-green-900 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/dashboard" className="text-xl font-bold">
            🥚 EggTrack AI
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/tracking"
              className="text-white hover:bg-green-600 dark:hover:bg-green-800 px-3 py-2 rounded transition text-sm"
            >
              📍 Tracking
            </Link>

            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className="bg-yellow-500 hover:bg-yellow-600 px-4 py-2 rounded text-sm font-medium transition"
              >
                ⚙️ Admin Panel
              </Link>
            )}

            <button
              onClick={toggle}
              className="p-2 rounded hover:bg-white/20 transition text-xl"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? '☀️' : '🌙'}
            </button>

            <NotificationBell />

            <span className="text-sm">👤 {user?.username}</span>

            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm"
            >
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={toggle}
              className="p-2 rounded hover:bg-white/20 transition text-xl"
            >
              {dark ? '☀️' : '🌙'}
            </button>
            <NotificationBell />
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-2xl"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {menuOpen && (
          <div className="md:hidden bg-green-800 dark:bg-green-950 px-4 py-3 space-y-2">
            <div className="text-sm mb-2">
              👤 {user?.username} ({user?.role})
            </div>

            <Link
              to="/tracking"
              onClick={() => setMenuOpen(false)}
              className="block hover:bg-green-600 py-2 rounded text-center transition"
            >
              📍 Track Orders
            </Link>

            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className="block bg-yellow-500 hover:bg-yellow-600 py-2 rounded text-center font-medium transition"
              >
                ⚙️ Admin Panel
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="w-full bg-red-600 hover:bg-red-700 py-2 rounded text-sm"
            >
              Logout
            </button>
          </div>
        )}
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default UserLayout;