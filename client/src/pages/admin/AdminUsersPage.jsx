import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../services/api';
import { formatFileSize, formatDate } from '../../utils/helpers';
import { LoadingSpinner, EmptyState, Pagination, SearchBar } from '../../components/common';
import toast from 'react-hot-toast';
import { HiOutlineUsers, HiOutlinePencil, HiOutlineNoSymbol, HiOutlineCheck } from 'react-icons/hi2';

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newQuotaGB, setNewQuotaGB] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getUsers({ page, search, role: roleFilter });
      if (res.success) {
        setUsers(res.data);
        setTotalPages(res.pagination.pages);
      }
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (q) => {
    setSearch(q);
    setPage(1);
  };

  const toggleStatus = async (id, isActive) => {
    try {
      await adminAPI.toggleUserStatus(id);
      toast.success(`User is now ${isActive ? 'inactive' : 'active'}`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const openQuotaModal = (user) => {
    setSelectedUser(user);
    setNewQuotaGB((user.storageQuota / (1024 * 1024 * 1024)).toString());
    setQuotaModalOpen(true);
  };

  const handleUpdateQuota = async (e) => {
    e.preventDefault();
    try {
      const quotaBytes = parseFloat(newQuotaGB) * 1024 * 1024 * 1024;
      await adminAPI.updateUserQuota(selectedUser.id, { storageQuota: quotaBytes });
      toast.success('Quota updated successfully');
      setQuotaModalOpen(false);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update quota');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <HiOutlineUsers className="text-3xl text-primary-600" />
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
          <div className="w-full md:w-1/3">
            <SearchBar onSearch={handleSearch} placeholder="Search users by name or email..." />
          </div>
          <div className="w-full md:w-auto">
            <select 
              value={roleFilter} 
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="input-field py-2"
            >
              <option value="">All Roles</option>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12"><LoadingSpinner /></div>
        ) : users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-sm">
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Role</th>
                  <th className="py-3 px-4 font-medium">Storage</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium hidden sm:table-cell">Created</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span className="font-medium">{formatFileSize(user.storageUsed || 0)}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-gray-500">{formatFileSize(user.storageQuota)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {user.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openQuotaModal(user)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors bg-gray-50 hover:bg-primary-50 rounded" 
                          title="Edit Quota"
                        >
                          <HiOutlinePencil size={18} />
                        </button>
                        <button 
                          onClick={() => toggleStatus(user.id, user.isActive)}
                          className={`p-1.5 transition-colors rounded ${
                            user.isActive 
                              ? 'text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50' 
                              : 'text-gray-400 hover:text-green-600 bg-gray-50 hover:bg-green-50'
                          }`}
                          title={user.isActive ? 'Deactivate User' : 'Activate User'}
                        >
                          {user.isActive ? <HiOutlineNoSymbol size={18} /> : <HiOutlineCheck size={18} />}
                        </button>
                      </div>
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
          <EmptyState icon={HiOutlineUsers} title="No users found" message="Try adjusting your search or filters." />
        )}
      </div>

      {quotaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Storage Quota</h2>
            <p className="text-sm text-gray-600 mb-4">Update quota for <strong>{selectedUser?.name}</strong></p>
            
            <form onSubmit={handleUpdateQuota}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Quota (in GB)</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0.1"
                  value={newQuotaGB} 
                  onChange={e => setNewQuotaGB(e.target.value)} 
                  className="input-field" 
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setQuotaModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
