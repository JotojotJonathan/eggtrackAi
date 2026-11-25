import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    email: user?.email || '',
    old_password: '',
    new_password: '',
  });

  const handleUpdateEmail = async () => {
    toast.success('Email updated (backend impl needed)');
  };

  const handleChangePassword = async () => {
    if (!formData.old_password || !formData.new_password) {
      toast.error('Please fill both password fields');
      return;
    }
    toast.success('Password change (backend impl needed)');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl lg:text-3xl font-bold">👤 My Profile</h1>

      {/* User Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">Account Information</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-500">Username</label>
            <p className="font-medium">{user?.username}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Role</label>
            <p className="font-medium">
              <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                {user?.role}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg mt-1"
            />
            <button
              onClick={handleUpdateEmail}
              className="mt-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
            >
              Update Email
            </button>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">Change Password</h2>
        <div className="space-y-3">
          <input
            type="password"
            placeholder="Current Password"
            value={formData.old_password}
            onChange={(e) => setFormData({ ...formData, old_password: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
          <input
            type="password"
            placeholder="New Password"
            value={formData.new_password}
            onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
          <button
            onClick={handleChangePassword}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            Change Password
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;