import { useState, useEffect } from 'react';
import { getAlerts } from '../../api/api';
import toast from 'react-hot-toast';

const AdminAlerts = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const res = await getAlerts();
      setAlerts(res.data);
    } catch (error) {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl lg:text-3xl font-bold mb-6">🔔 Alerts</h1>
      
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          ✅ No alerts. Everything is running smoothly!
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`p-4 rounded-lg border-l-4 bg-white shadow ${
                a.severity === 'CRITICAL' ? 'border-red-500' :
                a.severity === 'WARNING' ? 'border-yellow-500' :
                'border-blue-500'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:justify-between gap-1 mb-1">
                <span className="font-bold text-base lg:text-lg">{a.title}</span>
                <span className="text-xs text-gray-500">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{a.message}</p>
              <div className="flex gap-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  a.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                  a.severity === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {a.severity}
                </span>
                <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                  {a.alert_type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAlerts;