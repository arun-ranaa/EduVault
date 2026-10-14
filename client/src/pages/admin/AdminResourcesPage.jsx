import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import { formatFileSize, formatDate, getResourceTypeLabel } from '../../utils/helpers';
import { LoadingSpinner, EmptyState, Pagination, SearchBar, ConfirmModal } from '../../components/common';
import toast from 'react-hot-toast';
import { HiOutlineBookOpen, HiOutlineTrash, HiOutlineEye } from 'react-icons/hi2';

const AdminResourcesPage = () => {
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState(null);

  const fetchCategories = async () => {
    try {
      const res = await adminAPI.getCategories();
      if (res.success) {
        setCategories(res.data || []);
      }
    } catch (error) {
      console.error('Failed to load categories', error);
    }
  };

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getResources({ 
        page, 
        search, 
        category: categoryFilter, 
        type: typeFilter 
      });
      if (res.success) {
        setResources(res.data);
        setTotalPages(res.pagination.pages);
      }
    } catch (error) {
      toast.error('Failed to load resources');
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, typeFilter]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleDelete = (resource) => {
    setResourceToDelete(resource);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await adminAPI.deleteResource(resourceToDelete.id);
      toast.success('Resource deleted successfully');
      fetchResources();
    } catch (error) {
      toast.error('Failed to delete resource');
    } finally {
      setDeleteModalOpen(false);
      setResourceToDelete(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <HiOutlineBookOpen className="text-3xl text-primary-600" />
        <h1 className="text-3xl font-bold text-gray-900">Resource Management</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <SearchBar onSearch={(q) => { setSearch(q); setPage(1); }} placeholder="Search resources..." />
          </div>
          <div className="w-full md:w-48">
            <select 
              value={categoryFilter} 
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="input-field py-2"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-48">
            <select 
              value={typeFilter} 
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="input-field py-2"
            >
              <option value="">All Types</option>
              <option value="DOCUMENT">Document</option>
              <option value="VIDEO">Video</option>
              <option value="LINK">Link</option>
              <option value="ARCHIVE">Archive</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12"><LoadingSpinner /></div>
        ) : resources.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-sm">
                  <th className="py-3 px-4 font-medium">Title</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Category</th>
                  <th className="py-3 px-4 font-medium hidden md:table-cell">Size</th>
                  <th className="py-3 px-4 font-medium hidden md:table-cell">Date</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {resources.map(resource => (
                  <tr key={resource.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900 truncate max-w-xs">{resource.title}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {getResourceTypeLabel(resource.type)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {resource.category?.name || 'Uncategorized'}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-sm text-gray-500">
                      {formatFileSize(resource.fileSize || 0)}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-sm text-gray-500">
                      {formatDate(resource.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link to={`/resources/${resource.id}`} className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors bg-gray-50 hover:bg-primary-50 rounded" title="View">
                          <HiOutlineEye size={18} />
                        </Link>
                        <button onClick={() => handleDelete(resource)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors bg-gray-50 hover:bg-red-50 rounded" title="Delete">
                          <HiOutlineTrash size={18} />
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
          <EmptyState icon={HiOutlineBookOpen} title="No resources found" message="Try adjusting your search or filters." />
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Resource"
        message={`Are you sure you want to delete "${resourceToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmStyle="danger"
      />
    </div>
  );
};

export default AdminResourcesPage;
