import { useState, useEffect } from 'react';
import axios from 'axios';
import { getBuyers } from '../../api/api';
import { provinces, barangays, provincesList } from '../../data/philippines';
import SearchBar from '../../components/SearchBar';
import Pagination from '../../components/Pagination';
import toast from 'react-hot-toast';
import ExportButton from '../../components/ExportButton';
import { EXPORT_URLS } from '../../api/api';

const AdminBuyers = () => {
  const [buyers, setBuyers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '',
    province: '', municipality: '', barangay: '', purok: '', landmark: '',
    is_active: true,
  });

  const itemsPerPage = 10;

  useEffect(() => { loadBuyers(); }, []);

  useEffect(() => {
    let result = [...buyers];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(b =>
        b.name.toLowerCase().includes(s) ||
        b.email.toLowerCase().includes(s) ||
        b.phone?.includes(s)
      );
    }
    setFiltered(result);
    setCurrentPage(1);
  }, [search, buyers]);

  const loadBuyers = async () => {
    try {
      const res = await getBuyers();
      setBuyers(res.data);
    } catch {
      toast.error('Failed to load buyers');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setFormData({
      name: '', email: '', phone: '',
      province: 'Bohol', municipality: '', barangay: '', purok: '', landmark: '',
      is_active: true,
    });
    setShowModal(true);
  };

  const openEdit = (b: any) => {
    setEditing(b);
    setFormData({
      name: b.name,
      email: b.email,
      phone: b.phone,
      province: b.province || 'Bohol',
      municipality: b.municipality || '',
      barangay: b.barangay || '',
      purok: b.purok || '',
      landmark: b.landmark || '',
      is_active: b.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`http://${window.location.hostname}:8000/api/buyers/${editing.id}/`, formData);
        toast.success('✅ Buyer updated');
      } else {
        await axios.post('http://${window.location.hostname}:8000/api/buyers/', formData);
        toast.success('✅ Buyer added');
      }
      setShowModal(false);
      loadBuyers();
    } catch {
      toast.error('Failed to save');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this buyer?')) return;
    try {
      await axios.delete(`http://${window.location.hostname}:8000/api/buyers/${id}/`);
      toast.success('Deleted');
      loadBuyers();
    } catch {
      toast.error('Failed');
    }
  };

  const toggleActive = async (b: any) => {
    try {
      await axios.patch(`http://${window.location.hostname}:8000/api/buyers/${b.id}/`, { is_active: !b.is_active });
      loadBuyers();
    } catch {
      toast.error('Failed');
    }
  };

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const municipalities = formData.province ? provinces[formData.province] || [] : [];
  const barangayList = formData.municipality ? barangays[formData.municipality] || [] : [];

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-6">
  <h1 className="text-2xl lg:text-3xl font-bold">👥 Buyers Management</h1>
  <div className="flex gap-2">
    <ExportButton url={EXPORT_URLS.buyers} filename="buyers.csv" />
    <button onClick={openAdd} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
      ➕ Add Buyer
    </button>
  </div>
</div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search buyers by name, email, phone..." />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : paginated.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No buyers found</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 lg:px-4 py-3 text-left">Name</th>
                  <th className="px-2 lg:px-4 py-3 text-left">Email</th>
                  <th className="px-2 lg:px-4 py-3 text-left hidden lg:table-cell">Address</th>
                  <th className="px-2 lg:px-4 py-3 text-center">Active</th>
                  <th className="px-2 lg:px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((b) => (
                  <tr key={b.id} className="border-t hover:bg-gray-50">
                    <td className="px-2 lg:px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-2 lg:px-4 py-3">{b.email}</td>
                    <td className="px-2 lg:px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                      {b.barangay && b.municipality ? `${b.barangay}, ${b.municipality}` : '-'}
                    </td>
                    <td className="px-2 lg:px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(b)}
                        className={`px-2 py-1 text-xs rounded ${b.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                      >
                        {b.is_active ? '✅' : '❌'}
                      </button>
                    </td>
                    <td className="px-2 lg:px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => openEdit(b)} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">✏️</button>
                        <button onClick={() => handleDelete(b.id)} className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{editing ? 'Edit Buyer' : 'Add Buyer'}</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />

              <select value={formData.province} onChange={(e) => setFormData({ ...formData, province: e.target.value, municipality: '', barangay: '' })} className="w-full px-3 py-2 border rounded-lg">
                <option value="">-- Province --</option>
                {provincesList.map((p) => <option key={p}>{p}</option>)}
              </select>

              <select value={formData.municipality} onChange={(e) => setFormData({ ...formData, municipality: e.target.value, barangay: '' })} disabled={!formData.province} className="w-full px-3 py-2 border rounded-lg">
                <option value="">-- Municipality --</option>
                {municipalities.map((m) => <option key={m}>{m}</option>)}
              </select>

              <select value={formData.barangay} onChange={(e) => setFormData({ ...formData, barangay: e.target.value })} disabled={!formData.municipality} className="w-full px-3 py-2 border rounded-lg">
                <option value="">-- Barangay --</option>
                {barangayList.map((b) => <option key={b}>{b}</option>)}
              </select>

              <input type="text" placeholder="Purok/Street" value={formData.purok} onChange={(e) => setFormData({ ...formData, purok: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              <input type="text" placeholder="Landmark (optional)" value={formData.landmark} onChange={(e) => setFormData({ ...formData, landmark: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleSave} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700">Save</button>
              <button onClick={() => setShowModal(false)} className="bg-gray-300 px-4 py-2 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBuyers;