import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resourceAPI, bookmarkAPI, vaultAPI, userAPI } from '../../services/api';
import StorageUsage from '../../components/common/StorageUsage';
import {
  HiOutlineCloudArrowUp,
  HiOutlineBookmark,
  HiOutlineLockClosed,
  HiOutlineCircleStack,
  HiOutlineBookOpen,
  HiOutlineArrowRight
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { formatFileSize } from '../../utils/helpers';

const DashboardPage = () => {
  const { user } = useAuth();
  
  const [stats, setStats] = useState({
    uploads: 0,
    bookmarks: 0,
    vaultFiles: 0,
    storageUsed: 0,
    storageQuota: 0
  });
  const [recentUploads, setRecentUploads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [uploadsRes, bookmarksRes, vaultRes, storageRes] = await Promise.all([
          resourceAPI.getAll({ uploadedBy: user?.id, limit: 5 }), // Using resourceAPI instead of raw axios
          bookmarkAPI.getAll({ limit: 1 }),
          vaultAPI.getFiles({ limit: 1 }),
          userAPI.getStorage()
        ]);

        const resourcesData = uploadsRes.data?.data || [];
        setRecentUploads(resourcesData);
        
        setStats({
          uploads: uploadsRes.data?.pagination?.total || 0,
          bookmarks: bookmarksRes.data?.pagination?.total || 0,
          vaultFiles: vaultRes.data?.pagination?.total || 0,
          storageUsed: storageRes.data?.data?.used || storageRes.data?.used || 0,
          storageQuota: storageRes.data?.data?.quota || storageRes.data?.quota || 1073741824 // 1GB default
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchDashboardData();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 container mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name}!</h1>
        <p className="text-gray-500 mt-1">Here's an overview of your academic journey.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
          <div className="rounded-full bg-blue-100 p-3 mr-4">
            <HiOutlineCloudArrowUp className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">My Uploads</p>
            <p className="text-2xl font-semibold text-gray-900">{stats.uploads}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
          <div className="rounded-full bg-yellow-100 p-3 mr-4">
            <HiOutlineBookmark className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Bookmarks</p>
            <p className="text-2xl font-semibold text-gray-900">{stats.bookmarks}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
          <div className="rounded-full bg-purple-100 p-3 mr-4">
            <HiOutlineLockClosed className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Vault Files</p>
            <p className="text-2xl font-semibold text-gray-900">{stats.vaultFiles}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center">
          <div className="rounded-full bg-green-100 p-3 mr-4">
            <HiOutlineCircleStack className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Storage Used</p>
            <p className="text-2xl font-semibold text-gray-900">
              {formatFileSize(stats.storageUsed)}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions & Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4">
            <Link to="/resources" className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-primary-200 transition-all transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-primary-50 rounded-lg p-3 text-primary-600 group-hover:bg-primary-100 transition-colors">
                    <HiOutlineBookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Browse Resources</h3>
                    <p className="text-sm text-gray-500">Discover new materials</p>
                  </div>
                </div>
                <HiOutlineArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
              </div>
            </Link>

            <Link to="/upload" className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-primary-200 transition-all transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-50 rounded-lg p-3 text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <HiOutlineCloudArrowUp className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Upload Resource</h3>
                    <p className="text-sm text-gray-500">Share with the community</p>
                  </div>
                </div>
                <HiOutlineArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
            </Link>

            <Link to="/bookmarks" className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-primary-200 transition-all transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-yellow-50 rounded-lg p-3 text-yellow-600 group-hover:bg-yellow-100 transition-colors">
                    <HiOutlineBookmark className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">My Bookmarks</h3>
                    <p className="text-sm text-gray-500">View saved resources</p>
                  </div>
                </div>
                <HiOutlineArrowRight className="h-5 w-5 text-gray-400 group-hover:text-yellow-600 transition-colors" />
              </div>
            </Link>

            <Link to="/vault" className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-primary-200 transition-all transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-purple-50 rounded-lg p-3 text-purple-600 group-hover:bg-purple-100 transition-colors">
                    <HiOutlineLockClosed className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">My Vault</h3>
                    <p className="text-sm text-gray-500">Access private files</p>
                  </div>
                </div>
                <HiOutlineArrowRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
              </div>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-gray-900">Recent Uploads</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {recentUploads.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {recentUploads.map((resource) => (
                  <li key={resource.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <Link to={`/resources/${resource.id}`} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="bg-gray-100 p-2 rounded text-gray-500">
                          <HiOutlineBookOpen className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{resource.title}</p>
                          <p className="text-xs text-gray-500 truncate max-w-xs">{resource.description || 'No description'}</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(resource.createdAt).toLocaleDateString()}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center">
                <div className="mx-auto h-12 w-12 text-gray-300 mb-4">
                  <HiOutlineCloudArrowUp className="h-full w-full" />
                </div>
                <h3 className="text-sm font-medium text-gray-900">No uploads yet</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by sharing your first academic resource.</p>
                <div className="mt-4">
                  <Link to="/upload" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700">
                    Upload Resource
                  </Link>
                </div>
              </div>
            )}
            {recentUploads.length > 0 && (
              <div className="bg-gray-50 p-3 text-center border-t border-gray-200">
                <Link to="/resources?my=true" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                  View all uploads
                </Link>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Storage Usage</h2>
            <StorageUsage used={stats.storageUsed} total={stats.storageQuota} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
