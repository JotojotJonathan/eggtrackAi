import { useState, useEffect } from 'react';
import axios from 'axios';
import { getBuyers, getOrders, getPendingOrders, getUnreadAlerts, getTodayProduction } from '../../api/api';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    todayProduction: 0, pendingOrders: 0, activeBuyers: 0,
    unreadAlerts: 0, todayRevenue: 0, activeDeliveries: 0,
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      try {
        const prodRes = await getTodayProduction();
        setStats(prev => ({ ...prev, todayProduction: prodRes.data.total_eggs || 0 }));
      } catch {}

      const orderRes = await getPendingOrders();
      setStats(prev => ({ ...prev, pendingOrders: orderRes.data.length }));

      const buyerRes = await getBuyers();
      setStats(prev => ({ ...prev, activeBuyers: buyerRes.data.filter((b: any) => b.is_active).length }));

      const alertRes = await getUnreadAlerts();
      setStats(prev => ({ ...prev, unreadAlerts: alertRes.data.length }));
      setAlerts(alertRes.data.slice(0, 5));

      const allOrders = await getOrders();
      setOrders(allOrders.data.slice(0, 5));

      const today = new Date().toISOString().split('T')[0];
      const revenue = allOrders.data
        .filter((o: any) => o.order_date === today && o.status !== 'CANCELLED')
        .reduce((sum: number, o: any) => sum + parseFloat(o.total_amount), 0);
      setStats(prev => ({ ...prev, todayRevenue: revenue }));

      // ✅ GIGAMIT OG BACKTICKS
      const deliveryRes = await axios.get(`http://${window.location.hostname}:8000/api/deliveries/pending_deliveries/`);
      setStats(prev => ({ ...prev, activeDeliveries: deliveryRes.data.length }));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl lg:text-3xl font-bold dark:text-white">📊 Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/admin/production" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-green-500 hover:shadow-xl transition">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Today's Production</h3>
          <p className="text-3xl font-bold text-green-600">{stats.todayProduction}</p>
          <p className="text-xs text-gray-400">eggs</p>
        </Link>

        <Link to="/admin/orders" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-yellow-500 hover:shadow-xl transition">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Pending Orders</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.pendingOrders}</p>
          <p className="text-xs text-gray-400">waiting approval</p>
        </Link>

        <Link to="/admin/buyers" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-blue-500 hover:shadow-xl transition">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Active Buyers</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.activeBuyers}</p>
          <p className="text-xs text-gray-400">registered</p>
        </Link>

        <Link to="/admin/alerts" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-red-500 hover:shadow-xl transition">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Unread Alerts</h3>
          <p className="text-3xl font-bold text-red-600">{stats.unreadAlerts}</p>
          <p className="text-xs text-gray-400">needs attention</p>
        </Link>

        <Link to="/admin/deliveries" className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-purple-500 hover:shadow-xl transition">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Active Deliveries</h3>
          <p className="text-3xl font-bold text-purple-600">{stats.activeDeliveries}</p>
          <p className="text-xs text-gray-400">in progress</p>
        </Link>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-emerald-500">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Today's Revenue</h3>
          <p className="text-3xl font-bold text-emerald-600">₱{stats.todayRevenue.toFixed(2)}</p>
          <p className="text-xs text-gray-400">from paid orders</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-white">🔔 Recent Alerts</h2>
          <Link to="/admin/alerts" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">View all →</Link>
        </div>
        {alerts.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">✅ No unread alerts</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className={`p-3 rounded border-l-4 ${
                a.severity === 'CRITICAL' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                a.severity === 'WARNING' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              }`}>
                <div className="flex justify-between">
                  <span className="font-bold dark:text-white">{a.title}</span>
                  <span className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{a.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-white">📋 Recent Orders</h2>
          <Link to="/admin/orders" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left dark:text-white">#</th>
                <th className="px-4 py-3 text-left dark:text-white">Buyer</th>
                <th className="px-4 py-3 text-left dark:text-white">Item</th>
                <th className="px-4 py-3 text-right dark:text-white">Qty</th>
                <th className="px-4 py-3 text-right dark:text-white">Total</th>
                <th className="px-4 py-3 text-left dark:text-white">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 dark:text-white">{o.order_number || `#${o.id}`}</td>
                  <td className="px-4 py-3 dark:text-gray-300">{o.buyer_name}</td>
                  <td className="px-4 py-3 dark:text-gray-300">{o.egg_size} · {o.egg_type}</td>
                  <td className="px-4 py-3 text-right dark:text-gray-300">{o.quantity} {o.is_tray ? 'trays' : 'pcs'}</td>
                  <td className="px-4 py-3 text-right dark:text-white font-medium">₱{o.total_amount}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded ${
                      o.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      o.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      o.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;