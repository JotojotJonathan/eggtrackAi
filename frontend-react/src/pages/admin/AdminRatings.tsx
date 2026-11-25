import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Pagination from '../../components/Pagination';

const AdminRatings = () => {
  const [ratings, setRatings] = useState<any[]>([]);
  const [summary, setSummary] = useState({ average: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  useEffect(() => {
    loadRatings();
  }, []);

  const loadRatings = async () => {
    try {
      // ✅ GIGAMIT OG BACKTICKS
      const [rRes, sRes] = await Promise.all([
        axios.get(`http://${window.location.hostname}:8000/api/ratings/`),
        axios.get(`http://${window.location.hostname}:8000/api/ratings/summary/`),
      ]);
      setRatings(rRes.data);
      setSummary(sRes.data);
    } catch {
      toast.error('Failed to load ratings');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

  const totalPages = Math.ceil(ratings.length / itemsPerPage);
  const paginated = ratings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl lg:text-3xl font-bold dark:text-white">⭐ Customer Ratings</h1>

      <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rounded-2xl shadow-xl p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-yellow-100 text-sm">Average Rating</p>
            <p className="text-4xl lg:text-5xl font-bold">{summary.average} ★</p>
          </div>
          <div>
            <p className="text-yellow-100 text-sm">Total Reviews</p>
            <p className="text-4xl lg:text-5xl font-bold">{summary.total}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : paginated.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">No ratings yet</div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((r) => (
              <div key={r.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium dark:text-white">Order #{r.order_id}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">by {r.buyer_name}</span>
                  </div>
                  <span className="text-yellow-500 text-lg">{renderStars(r.rating)}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{r.comment}"</p>}
                <p className="text-xs text-gray-400 mt-2">{new Date(r.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}
    </div>
  );
};

export default AdminRatings;