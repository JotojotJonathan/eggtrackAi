import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const token = localStorage.getItem('access_token');
      // ✅ GIGAMIT OG BACKTICKS
      const res = await axios.get(`http://${window.location.hostname}:8000/api/notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(res.data);
      setUnreadCount(res.data.filter((n: any) => !n.is_read).length);
    } catch (error) {
      // Silent fail
    }
  };

  const handleClick = async (n: any) => {
    try {
      const token = localStorage.getItem('access_token');
      // ✅ GIGAMIT OG BACKTICKS
      await axios.post(
        `http://${window.location.hostname}:8000/api/notifications/${n.id}/read/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadNotifications();
      if (n.link) {
        navigate(n.link);
        setOpen(false);
      }
    } catch {
      toast.error('Failed to open notification');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('access_token');
      // ✅ GIGAMIT OG BACKTICKS
      await axios.post(
        `http://${window.location.hostname}:8000/api/notifications/read_all/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      loadNotifications();
    } catch {
      toast.error('Failed');
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded hover:bg-white/20 transition"
        title="Notifications"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-2xl z-40 max-h-96 overflow-hidden border dark:border-gray-700">
          <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
            <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">🔔 Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`p-3 border-b dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                    !n.is_read ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-medium text-sm text-gray-800 dark:text-gray-100">{n.title}</p>
                    {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1 flex-shrink-0"></span>}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;