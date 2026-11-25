import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { getOrders } from '../../api/api';
import toast from 'react-hot-toast';
import SearchBar from '../../components/SearchBar';
import Pagination from '../../components/Pagination';
import ExportButton from '../../components/ExportButton';
import { EXPORT_URLS } from '../../api/api';

const AdminOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [paymentData, setPaymentData] = useState({
    payment_status: 'UNPAID',
    payment_method: 'COD',
    payment_reference: '',
    amount_paid: 0,
  });

  const itemsPerPage = 10;

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    let result = [...orders];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(o =>
        o.buyer_name?.toLowerCase().includes(s) ||
        o.id.toString().includes(s) ||
        o.buyer_email?.toLowerCase().includes(s)
      );
    }
    if (statusFilter) result = result.filter(o => o.status === statusFilter);
    if (paymentFilter) result = result.filter(o => o.payment_status === paymentFilter);
    setFiltered(result);
    setCurrentPage(1);
  }, [search, statusFilter, paymentFilter, orders]);

  const loadOrders = async () => {
    try {
      const res = await getOrders();
      setOrders(res.data);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await axios.post(`http://${window.location.hostname}:8000/api/orders/${id}/approve/`);
      toast.success('✅ Order approved');
      loadOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('Cancel this order?')) return;
    try {
      await axios.post(`http://${window.location.hostname}:8000/api/orders/${id}/reject/`);
      toast.success('Order cancelled');
      loadOrders();
    } catch {
      toast.error('Failed to cancel');
    }
  };

  const openPaymentModal = (order: any) => {
    setSelectedOrder(order);
    setPaymentData({
      payment_status: order.payment_status || 'UNPAID',
      payment_method: order.payment_method || 'COD',
      payment_reference: order.payment_reference || '',
      amount_paid: parseFloat(order.amount_paid) || 0,
    });
    setShowPaymentModal(true);
  };

  const savePayment = async () => {
    try {
      await axios.post(
        `http://${window.location.hostname}:8000/api/orders/${selectedOrder.id}/update_payment/`,
        paymentData
      );
      toast.success('💳 Payment updated');
      setShowPaymentModal(false);
      loadOrders();
    } catch {
      toast.error('Failed');
    }
  };

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const statusColor = (s: string) => {
    switch (s) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-blue-100 text-blue-800';
      case 'IN_DELIVERY': return 'bg-purple-100 text-purple-800';
      default: return 'bg-red-100 text-red-800';
    }
  };

  const paymentColor = (s: string) => {
    switch (s) {
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-red-100 text-red-800';
    }
  };

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-6">
  <h1 className="text-2xl lg:text-3xl font-bold">📋 Orders Management</h1>
  <ExportButton url={EXPORT_URLS.orders} filename="orders.csv" />
</div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search buyer, order #..." />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="IN_DELIVERY">In Delivery</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">All Payments</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : paginated.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No orders match your filters
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 lg:px-4 py-3 text-left">#</th>
                  <th className="px-2 lg:px-4 py-3 text-left">Buyer</th>
                  <th className="px-2 lg:px-4 py-3 text-right">Qty</th>
                  <th className="px-2 lg:px-4 py-3 text-right hidden lg:table-cell">Total</th>
                  <th className="px-2 lg:px-4 py-3 text-left">Status</th>
                  <th className="px-2 lg:px-4 py-3 text-left">Payment</th>
                  <th className="px-2 lg:px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-gray-50">
                    <td className="px-2 lg:px-4 py-3">{o.order_number || '#' + o.id}</td>
                    <td className="px-2 lg:px-4 py-3">{o.buyer_name || 'Unknown'}</td>
                    <td className="px-2 lg:px-4 py-3 text-right">{o.quantity}</td>
                    <td className="px-2 lg:px-4 py-3 text-right hidden lg:table-cell">₱{o.total_amount}</td>
                    <td className="px-2 lg:px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded ${statusColor(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-2 lg:px-4 py-3">
                      <button
                        onClick={() => openPaymentModal(o)}
                        className={`px-2 py-1 text-xs rounded cursor-pointer ${paymentColor(o.payment_status || 'UNPAID')}`}
                      >
                        {o.payment_status || 'UNPAID'}
                      </button>
                    </td>
                    <td className="px-2 lg:px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        {o.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(o.id)}
                              className="bg-green-600 text-white px-2 py-1 rounded text-xs"
                            >
                              ✅
                            </button>
                            <button
                              onClick={() => handleReject(o.id)}
                              className="bg-red-600 text-white px-2 py-1 rounded text-xs"
                            >
                              ❌
                            </button>
                          </>
                        )}
                        {o.status !== 'CANCELLED' && (
                          <Link
                            to={`/admin/map?order=${o.id}`}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded text-xs"
                            title="View on map"
                          >
                            🗺️
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">💳 Payment for Order #{selectedOrder?.id}</h3>
            <p className="text-sm text-gray-600 mb-4">
              Total: <strong>₱{selectedOrder?.total_amount}</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Status</label>
                <select
                  value={paymentData.payment_status}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="UNPAID">Unpaid</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="COD">Cash on Delivery</option>
                  <option value="GCASH">GCash</option>
                  <option value="MAYA">Maya</option>
                  <option value="BANK">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reference #</label>
                <input
                  type="text"
                  value={paymentData.payment_reference}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_reference: e.target.value })}
                  placeholder="e.g., GCash ref #"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount Paid (₱)</label>
                <input
                  type="number"
                  value={paymentData.amount_paid}
                  onChange={(e) => setPaymentData({ ...paymentData, amount_paid: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={savePayment} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700">
                Save
              </button>
              <button onClick={() => setShowPaymentModal(false)} className="bg-gray-300 px-4 py-2 rounded">
                Cancel
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;