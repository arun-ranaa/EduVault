import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../services/api';
import { formatDateTime } from '../../utils/helpers';
import { LoadingSpinner, EmptyState, Pagination } from '../../components/common';
import { HiOutlineClock } from 'react-icons/hi2';
import toast from 'react-hot-toast';

const AdminActivityPage = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getActivities({ page, type: typeFilter });
      if (res.success) {
        setActivities(res.data || []);
        setTotalPages(res.pagination?.pages || 1);
      }
    } catch (error) {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const getActionColor = (action) => {
    if (!action) return 'bg-gray-100 text-gray-800';
    if (action.includes('CREATED') || action.includes('UPLOADED') || action.includes('REGISTERED')) return 'bg-green-100 text-green-800';
    if (action.includes('DELETED') || action.includes('REMOVED')) return 'bg-red-100 text-red-800';
    if (action.includes('UPDATED') || action.includes('EDIT')) return 'bg-blue-100 text-blue-800';
    if (action.includes('LOGIN')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <HiOutlineClock className="text-3xl text-primary-600" />
        <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex justify-end mb-6">
          <div className="w-full md:w-64">
            <select 
              value={typeFilter} 
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="input-field py-2"
            >
              <option value="">All Activities</option>
              <option value="USER">User Actions</option>
              <option value="RESOURCE">Resource Actions</option>
              <option value="VAULT">Vault Actions</option>
              <option value="ADMIN">Admin Actions</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12"><LoadingSpinner /></div>
        ) : activities.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-sm">
                  <th className="py-3 px-4 font-medium w-1/4">User</th>
                  <th className="py-3 px-4 font-medium">Action</th>
                  <th className="py-3 px-4 font-medium w-2/5 hidden sm:table-cell">Details</th>
                  <th className="py-3 px-4 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {activities.map(activity => (
                  <tr key={activity.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">
                      {activity.user ? (
                        <>
                          <p className="font-medium text-gray-900">{activity.user.name}</p>
                          <p className="text-xs text-gray-500">{activity.user.email}</p>
                        </>
                      ) : (
                        <p className="text-gray-500 italic">System / Unknown</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${getActionColor(activity.action)}`}>
                        {activity.action || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell text-sm text-gray-700">
                      {activity.details || '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-gray-500 whitespace-nowrap">
                      {formatDateTime(activity.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </div>
        ) : (
          <EmptyState icon={HiOutlineClock} title="No activities found" message="There are no system activities matching your filters." />
        )}
      </div>
    </div>
  );
};

export default AdminActivityPage;
