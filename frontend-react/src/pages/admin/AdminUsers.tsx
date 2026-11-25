import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import SearchBar from '../../components/SearchBar';
import Pagination from '../../components/Pagination';

const AdminUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', phone: '', role: 'WORKER' });

  const itemsPerPage = 10;

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let result = [...users];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(u => u.username.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s));
    }
    if (roleFilter) result = result.filter(u => u.role === roleFilter);
    setFiltered(result);
    setCurrentPage(1);
  }, [search, roleFilter, users]);

  const loadUsers = async () => {
    try {
      // ✅ GIGAMIT OG BACKTICKS
      const res = await axios.get(`http://${window.location.hostname}:8000/api/users/`);
      const enriched = await Promise.all(
        res.data.map(async (u: any) => {
          try {
            const profileRes = await axios.get(`http://${window.location.hostname}:8000/api/users/${u.id}/`);
            return { ...u, role: profileRes.data.role || 'WORKER' };
          } catch {
            return { ...u, role: 'WORKER' };
          }
        })
      );
      setUsers(enriched);
    } catch {
      toast.error('Failed to load users');
    }
  };

  const handleSave = async () => {
    if (!formData.username || !formData.password) {
      toast.error('Username and password required');
      return;
    }
    try {
      // ✅ GIGAMIT OG BACKTICKS
      await axios.post(`http://${window.location.hostname}:8000/api/auth/create_staff/`, formData);
      toast.success('✅ Account created');
      setShowModal(false);
      setFormData({ username: '', email: '', password: '', first_name: '', last_name: '', phone: '', role: 'WORKER' });
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed');
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800';
      case 'WORKER': return 'bg-green-100 text-green-800';
      case 'DELIVERY': return 'bg-blue-100 text-blue-800';
      case 'BUYER': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold dark:text-white">👤 User Management</h1>
        <button onClick={() => setShowModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">➕ Create Staff Account</button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search users..." />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600">
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="WORKER">Worker</option>
          <option value="DELIVERY">Delivery</option>
          <option value="BUYER">Buyer</option>
        </select>
      </div>

      {paginated.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">No users found</div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left dark:text-white">Username</th>
                  <th className="px-4 py-3 text-left dark:text-white hidden lg:table-cell">Email</th>
                  <th className="px-4 py-3 text-left dark:text-white">Role</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((u) => (
                  <tr key={u.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-medium dark:text-white">{u.username}</td>
                    <td className="px-4 py-3 dark:text-gray-300 hidden lg:table-cell">{u.email || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded ${roleColor(u.role)}`}>{u.role}</span>
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 dark:text-white">Create Staff Account</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Role *</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600">
                  <option value="WORKER">🐔 Farm Worker</option>
                  <option value="DELIVERY">🚚 Delivery Staff</option>
                  <option value="ADMIN">👑 Admin</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-white">First Name</label>
                  <input type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-white">Last Name</label>
                  <input type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Username *</label>
                <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Phone</label>
                <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Password *</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600" required />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleSave} className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">Create</button>
              <button onClick={() => setShowModal(false)} className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white px-4 py-2 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;