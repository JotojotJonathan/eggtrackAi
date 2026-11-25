import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { provinces, barangays, provincesList } from '../data/philippines';

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirm_password: '',
    email: '',
    name: '',
    phone: '',
    province: 'Bohol',
    municipality: '',
    barangay: '',
    purok: '',
    landmark: '',
  });

  const municipalities = formData.province ? provinces[formData.province] || [] : [];
  const barangayList = formData.municipality ? barangays[formData.municipality] || [] : [];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'province') {
      setFormData({ ...formData, province: value, municipality: '', barangay: '' });
    } else if (name === 'municipality') {
      setFormData({ ...formData, municipality: value, barangay: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.username || !formData.password || !formData.email) {
        toast.error('Please fill all account fields');
        return;
      }
      if (formData.password !== formData.confirm_password) {
        toast.error('Passwords do not match');
        return;
      }
      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
    } else if (step === 2) {
      if (!formData.name || !formData.phone) {
        toast.error('Please fill name and phone');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.province || !formData.municipality || !formData.barangay) {
      toast.error('Please complete address');
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://${window.location.hostname}:8000/api/auth/register/', {
        username: formData.username,
        password: formData.password,
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
        province: formData.province,
        municipality: formData.municipality,
        barangay: formData.barangay,
        purok: formData.purok,
        landmark: formData.landmark,
      });
      toast.success('🎉 Registration successful! Please log in.');
      setTimeout(() => navigate('/login'), 1500);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 to-green-700 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 lg:p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-3xl lg:text-4xl font-bold text-green-700 dark:text-green-400">
            🥚 EggTrack AI
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Create your buyer account</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-6">
          {['Account', 'Personal', 'Address'].map((label, i) => (
            <div key={label} className="flex-1 flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  step >= i + 1 ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}
              >
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className="text-xs mt-1 text-gray-600 dark:text-gray-400">{label}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Username *</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Choose a username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Min. 6 characters"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Confirm Password *</label>
                <input
                  type="password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Re-enter password"
                  required
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Juan Dela Cruz"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Phone *</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="09XX XXX XXXX"
                  required
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Province *</label>
                <select
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">-- Select Province --</option>
                  {provincesList.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Municipality/City *</label>
                <select
                  name="municipality"
                  value={formData.municipality}
                  onChange={handleChange}
                  disabled={!formData.province}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">-- Select Municipality --</option>
                  {municipalities.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Barangay *</label>
                <select
                  name="barangay"
                  value={formData.barangay}
                  onChange={handleChange}
                  disabled={!formData.municipality}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">-- Select Barangay --</option>
                  {barangayList.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Purok / Street</label>
                <input
                  type="text"
                  name="purok"
                  value={formData.purok}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., Purok 3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-white">Landmark (optional)</label>
                <input
                  type="text"
                  name="landmark"
                  value={formData.landmark}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border dark:bg-gray-700 dark:text-white"
                  placeholder="Near Barangay Hall"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-6">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white px-4 py-3 rounded-lg hover:bg-gray-400"
              >
                ← Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium"
              >
                Next →
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
              >
                {loading ? 'Registering...' : '🎉 Create Account'}
              </button>
            )}
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-green-600 dark:text-green-400 font-medium hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;