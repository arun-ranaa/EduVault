import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { userAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/helpers';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StorageUsage from '../../components/common/StorageUsage';
import { HiOutlineKey, HiOutlineUser, HiOutlineCircleStack, HiOutlineArrowRightOnRectangle } from 'react-icons/hi2';

const SettingsPage = () => {
  const { user, logout } = useAuth();
  const [storageInfo, setStorageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const res = await userAPI.getStorage();
        setStorageInfo(res.data?.data || res.data);
      } catch (error) {
        console.error('Failed to load storage info', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchStorage();
    }
  }, [user]);

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwords.newPassword !== passwords.confirmPassword) {
      return toast.error('New passwords do not match');
    }
    
    if (passwords.newPassword.length < 6) {
      return toast.error('New password must be at least 6 characters long');
    }
    
    try {
      setSavingPassword(true);
      await userAPI.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      toast.success('Password changed successfully');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-primary-600 font-medium">
              <HiOutlineUser size={24} /> Account Info
            </div>
            <div className="text-sm">
              <p className="text-gray-500 mb-1">Email</p>
              <p className="font-medium text-gray-900">{user?.email}</p>
            </div>
            <div className="text-sm">
              <p className="text-gray-500 mb-1">Role</p>
              <p className="font-medium text-gray-900">{user?.role}</p>
            </div>
            <div className="text-sm">
              <p className="text-gray-500 mb-1">Member Since</p>
              <p className="font-medium text-gray-900">{user?.createdAt ? formatDate(user.createdAt) : 'N/A'}</p>
            </div>
          </div>
          
          <div className="bg-red-50 rounded-xl border border-red-100 p-6 mt-6">
            <h3 className="text-red-700 font-bold mb-2">Danger Zone</h3>
            <p className="text-red-600 text-sm mb-4">This will end your current session.</p>
            <button 
              onClick={logout}
              className="w-full bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 flex justify-center items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors"
            >
              <HiOutlineArrowRightOnRectangle /> Logout
            </button>
          </div>
        </div>
        
        <div className="md:col-span-2 space-y-6">
          {storageInfo && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 text-gray-900 font-bold text-lg mb-6">
                <HiOutlineCircleStack className="text-primary-600" size={24} /> Storage Usage
              </div>
              <StorageUsage used={storageInfo.used} total={storageInfo.quota} />
            </div>
          )}
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 text-gray-900 font-bold text-lg mb-6">
              <HiOutlineKey className="text-primary-600" size={24} /> Change Password
            </div>
            
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwords.currentPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-2 rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwords.newPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-2 rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  required
                  minLength="6"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwords.confirmPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-2 rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  required
                />
              </div>
              
              <div className="pt-2">
                <button type="submit" disabled={savingPassword} className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700">
                  {savingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
