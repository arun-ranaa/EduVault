import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import { formatFileSize, getResourceTypeLabel } from '../../utils/helpers';
import { LoadingSpinner } from '../../components/common';
import { HiOutlineUsers, HiOutlineBookOpen, HiOutlineLockClosed, HiOutlineCircleStack, HiArrowRight } from 'react-icons/hi2';
import { toast } from 'react-hot-toast';

const AdminDashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await adminAPI.getDashboard();
        setStats(res.data);
      } catch (error) {
        toast.error('Failed to load admin dashboard');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboard();
  }, []);

  if (loading) return <div className="py-20"><LoadingSpinner /></div>;
  if (!stats) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <div className="bg-blue-50 p-4 rounded-full text-blue-600">
            <HiOutlineUsers size={32} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalUsers || 0}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <div className="bg-green-50 p-4 rounded-full text-green-600">
            <HiOutlineBookOpen size={32} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Resources</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalResources || 0}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <div className="bg-purple-50 p-4 rounded-full text-purple-600">
            <HiOutlineLockClosed size={32} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Vault Files</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalVaultFiles || 0}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <div className="bg-orange-50 p-4 rounded-full text-orange-600">
            <HiOutlineCircleStack size={32} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Storage Used</p>
            <p className="text-2xl font-bold text-gray-900">{formatFileSize(stats.totalStorageUsed || 0)}</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Resources by Type</h2>
          <div className="space-y-4 mt-4">
            {stats.resourcesByType && stats.resourcesByType.length > 0 ? (
              stats.resourcesByType.map(({ type, count }) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium capitalize">{type.toLowerCase()}</span>
                  <span className="bg-gray-100 text-gray-800 py-1 px-3 rounded-full text-sm font-bold">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No resources data available</p>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Quick Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Link to="/admin/users" className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-primary-500 hover:shadow-md transition-all group">
              <div className="flex items-center gap-3 text-gray-800 font-medium">
                <HiOutlineUsers className="text-primary-600" size={24} /> Manage Users
              </div>
              <HiArrowRight className="text-gray-400 group-hover:text-primary-600 transition-colors" />
            </Link>
            
            <Link to="/admin/resources" className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-primary-500 hover:shadow-md transition-all group">
              <div className="flex items-center gap-3 text-gray-800 font-medium">
                <HiOutlineBookOpen className="text-primary-600" size={24} /> Manage Resources
              </div>
              <HiArrowRight className="text-gray-400 group-hover:text-primary-600 transition-colors" />
            </Link>
            
            <Link to="/admin/categories" className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-primary-500 hover:shadow-md transition-all group">
              <div className="flex items-center gap-3 text-gray-800 font-medium">
                <HiOutlineBookOpen className="text-primary-600" size={24} /> Categories
              </div>
              <HiArrowRight className="text-gray-400 group-hover:text-primary-600 transition-colors" />
            </Link>
            
            <Link to="/admin/storage" className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-primary-500 hover:shadow-md transition-all group">
              <div className="flex items-center gap-3 text-gray-800 font-medium">
                <HiOutlineCircleStack className="text-primary-600" size={24} /> Storage Overview
              </div>
              <HiArrowRight className="text-gray-400 group-hover:text-primary-600 transition-colors" />
            </Link>
            
            <Link to="/admin/activity" className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-primary-500 hover:shadow-md transition-all group sm:col-span-2">
              <div className="flex items-center gap-3 text-gray-800 font-medium">
                <HiOutlineBookOpen className="text-primary-600" size={24} /> Activity Log
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-primary-100 text-primary-800 py-0.5 px-2 rounded-full text-xs font-bold">{stats.recentActivityCount || 0} recent</span>
                <HiArrowRight className="text-gray-400 group-hover:text-primary-600 transition-colors" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
