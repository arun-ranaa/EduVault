import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { formatFileSize, calculateStoragePercentage } from '../../utils/helpers';
import { LoadingSpinner, EmptyState } from '../../components/common';
import { HiOutlineCircleStack, HiOutlineServer } from 'react-icons/hi2';
import toast from 'react-hot-toast';

const AdminStoragePage = () => {
  const [storageData, setStorageData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const res = await adminAPI.getStorage();
        if (res.success) {
          setStorageData(res.data);
        }
      } catch (error) {
        toast.error('Failed to load storage data');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchStorage();
  }, []);

  if (loading) return <div className="py-20"><LoadingSpinner /></div>;
  if (!storageData) return null;

  const totalUsed = storageData.totalUsed || 0;
  const totalAllocated = storageData.totalQuota || 0;
  const globalPercentage = totalAllocated > 0 ? calculateStoragePercentage(totalUsed, totalAllocated) : 0;
  
  const userStorage = Array.isArray(storageData.userBreakdown) 
    ? [...storageData.userBreakdown].sort((a, b) => b.storageUsed - a.storageUsed)
    : [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <HiOutlineCircleStack className="text-3xl text-primary-600" />
        <h1 className="text-3xl font-bold text-gray-900">Storage Overview</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-1 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl shadow-md p-6 text-white">
          <div className="flex items-center gap-3 mb-6 opacity-90">
            <HiOutlineServer size={28} />
            <h2 className="text-xl font-bold">Global Storage</h2>
          </div>
          
          <div className="mb-6">
            <p className="text-primary-100 text-sm font-medium mb-1">Total Used Across System</p>
            <p className="text-4xl font-bold">{formatFileSize(totalUsed)}</p>
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2 opacity-90">
              <span>{globalPercentage.toFixed(1)}% of total allocated</span>
              <span>{formatFileSize(totalAllocated)}</span>
            </div>
            <div className="w-full bg-primary-900/50 rounded-full h-3">
              <div 
                className="bg-white h-3 rounded-full" 
                style={{ width: `${Math.min(globalPercentage, 100)}%` }}
              ></div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-primary-500/30">
            <p className="text-sm opacity-90">Total Users: <span className="font-bold">{userStorage.length}</span></p>
          </div>
        </div>
        
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden">
          <h2 className="text-xl font-bold text-gray-900 mb-6">User Storage Breakdown</h2>
          
          {userStorage.length > 0 ? (
            <div className="overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200 text-gray-500 text-sm">
                    <th className="py-2 px-2 font-medium">User</th>
                    <th className="py-2 px-2 font-medium">Usage</th>
                    <th className="py-2 px-2 font-medium">Capacity</th>
                  </tr>
                </thead>
                <tbody>
                  {userStorage.map(user => {
                    const percent = calculateStoragePercentage(user.storageUsed, user.storageQuota);
                    const isHigh = percent > 85;
                    return (
                      <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </td>
                        <td className="py-3 px-2">
                          <p className="text-sm font-medium">{formatFileSize(user.storageUsed)}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(user.storageQuota)} limit</p>
                        </td>
                        <td className="py-3 px-2 w-1/3 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${isHigh ? 'bg-red-500' : 'bg-primary-500'}`} 
                                style={{ width: `${Math.min(percent, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium w-8 text-right">{percent.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={HiOutlineCircleStack} title="No storage data" message="No user storage data is available yet." />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminStoragePage;
