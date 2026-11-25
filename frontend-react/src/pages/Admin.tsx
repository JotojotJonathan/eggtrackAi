import { useState, useEffect } from 'react';
import { getBuyers, getOrders, getPendingOrders, getUnreadAlerts, getTodayProduction } from '../api/api';

const Admin = () => {
  const [stats, setStats] = useState({
    todayProduction: 0,
    pendingOrders: 0,
    activeBuyers: 0,
    unreadAlerts: 0,
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
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
      setBuyers(buyerRes.data);

      const alertRes = await getUnreadAlerts();
      setStats(prev => ({ ...prev, unreadAlerts: alertRes.data.length }));
      setAlerts(alertRes.data);

      const allOrders = await getOrders();
      setOrders(allOrders.data.slice(0, 20));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <h3 className="text-sm text-gray-500">Today's Production</h3>
          <p className="text-2xl font-bold text-green-600">{stats.todayProduction}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
          <h3 className="text-sm text-gray-500">Pending Orders</h3>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendingOrders}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <h3 className="text-sm text-gray-500">Active Buyers</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.activeBuyers}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <h3 className="text-sm text-gray-500">Unread Alerts</h3>
          <p className="text-2xl font-bold text-red-600">{stats.unreadAlerts}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">🔔 Recent Alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-gray-500">No unread alerts</p>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 10).map((alert) => (
              <div key={alert.id} className={`p-3 rounded border-l-4 ${
                alert.severity === 'CRITICAL' ? 'border-red-500 bg-red-50' :
                alert.severity === 'WARNING' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}>
                <div className="flex justify-between">
                  <span className="font-bold">{alert.title}</span>
                  <span className="text-xs text-gray-500">{new Date(alert.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-600">{alert.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">📋 Recent Orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Buyer</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="px-4 py-2">#{order.id}</td>
                  <td className="px-4 py-2">{order.buyer_name || 'Unknown'}</td>
                  <td className="px-4 py-2">{order.order_date}</td>
                  <td className="px-4 py-2 text-right">{order.quantity}</td>
                  <td className="px-4 py-2 text-right">₱{order.total_amount}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>{order.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">👥 Buyers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-center">Active</th>
              </tr>
            </thead>
            <tbody>
              {buyers.map((buyer) => (
                <tr key={buyer.id} className="border-t">
                  <td className="px-4 py-2">{buyer.name}</td>
                  <td className="px-4 py-2">{buyer.email}</td>
                  <td className="px-4 py-2">{buyer.phone}</td>
                  <td className="px-4 py-2 text-center">{buyer.is_active ? '✅' : '❌'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Admin;