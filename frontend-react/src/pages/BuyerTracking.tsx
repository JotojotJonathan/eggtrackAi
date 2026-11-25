import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const BuyerTracking = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000); // Auto-refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    try {
      const res = await axios.get(`http://${window.location.hostname}:8000/api/orders/`);
      const myOrders = res.data.filter((o: any) => o.buyer_email === user?.email);
      setOrders(myOrders);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getProgress = (status: string) => {
    switch (status) {
      case 'PENDING': return 1;
      case 'APPROVED': return 2;
      case 'IN_DELIVERY': return 3;
      case 'COMPLETED': return 4;
      default: return 0;
    }
  };

  const steps = ['Placed', 'Approved', 'On the Way', 'Delivered'];

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl lg:text-3xl font-bold dark:text-white">📍 Track My Orders</h1>

      {orders.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
          No orders to track. <Link to="/buyer" className="text-blue-600 underline">Place an order</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const progress = getProgress(o.status);
            return (
              <div key={o.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2 mb-6">
                  <div>
                    <h3 className="font-bold text-lg dark:text-white">{o.order_number || `Order #${o.id}`}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {o.quantity} {o.is_tray ? 'trays' : 'pcs'} · {o.egg_size} {o.egg_type} · ₱{o.total_amount}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Delivery Date: {o.delivery_date}
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-sm rounded self-start lg:self-center ${
                    o.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    o.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    o.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                    o.status === 'IN_DELIVERY' ? 'bg-purple-100 text-purple-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {o.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center justify-between mt-6">
                  {steps.map((step, i) => {
                    const stepNum = i + 1;
                    const isComplete = progress >= stepNum;
                    return (
                      <div key={step} className="flex-1 flex flex-col items-center relative">
                        {i > 0 && (
                          <div className={`absolute top-4 right-1/2 w-full h-1 ${
                            progress >= stepNum ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                          }`} style={{ zIndex: 0 }} />
                        )}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                          isComplete ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                        }`}>
                          {isComplete ? '✓' : stepNum}
                        </div>
                        <span className={`text-xs mt-2 text-center ${
                          isComplete ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BuyerTracking;