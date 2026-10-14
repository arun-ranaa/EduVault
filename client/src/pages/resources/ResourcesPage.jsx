import React, { useState, useEffect } from 'react';
import { resourceAPI, bookmarkAPI, adminAPI } from '../../services/api';
import ResourceCard from '../../components/resources/ResourceCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import SearchBar from '../../components/common/SearchBar';
import toast from 'react-hot-toast';

const ResourceTypes = [
  { value: '', label: 'All Types' },
  { value: 'NOTES', label: 'Notes' },
  { value: 'BOOK', label: 'Book' },
  { value: 'QUESTION_PAPER', label: 'Question Paper' },
  { value: 'ASSIGNMENT', label: 'Assignment' },
  { value: 'STUDY_MATERIAL', label: 'Study Material' },
  { value: 'QUESTION_BANK', label: 'Question Bank' },
  { value: 'LAB_RESOURCE', label: 'Lab Resource' },
  { value: 'OTHER', label: 'Other' }
];

const ResourcesPage = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [pagination, setPagination] = useState({ page: 1, limit: 12, pages: 1 });
  
  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [subject, setSubject] = useState('');
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(1);
  const limit = 12;

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchResources();
    fetchBookmarks();
  }, [search, category, resourceType, subject, tag, page]);

  const fetchCategories = async () => {
    try {
      if (adminAPI?.getCategories) {
        const response = await adminAPI.getCategories();
        setCategories(response.data?.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  };

  const fetchResources = async () => {
    setLoading(true);
    try {
      const params = { search, category, resourceType, subject, tag, page, limit };
      const response = await resourceAPI.getAll(params);
      setResources(response.data?.data || []);
      setPagination({
        page: response.data?.pagination?.page || page,
        limit: response.data?.pagination?.limit || limit,
        pages: response.data?.pagination?.pages || 1
      });
    } catch (error) {
      console.error('Failed to fetch resources:', error);
      toast.error('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const response = await bookmarkAPI.getAll({ limit: 1000 }); 
      const bookmarks = response.data?.data || [];
      const ids = new Set(bookmarks.map(b => b.resourceId));
      setBookmarkedIds(ids);
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
    }
  };

  const handleBookmarkToggle = async (resourceId) => {
    try {
      if (bookmarkedIds.has(resourceId)) {
        await bookmarkAPI.remove(resourceId);
        setBookmarkedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(resourceId);
          return newSet;
        });
        toast.success('Removed from bookmarks');
      } else {
        await bookmarkAPI.add(resourceId);
        setBookmarkedIds(prev => {
          const newSet = new Set(prev);
          newSet.add(resourceId);
          return newSet;
        });
        toast.success('Added to bookmarks');
      }
    } catch (error) {
      console.error('Bookmark toggle error:', error);
      toast.error('Failed to update bookmark');
    }
  };

  const handleSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setResourceType('');
    setSubject('');
    setTag('');
    setPage(1);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Academic Resources</h1>
        <p className="text-gray-600">Discover and share study materials, notes, and question papers.</p>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-8 space-y-4">
        <div className="max-w-2xl mx-auto">
          {SearchBar ? <SearchBar onSearch={handleSearch} placeholder="Search resources..." value={search} /> : 
            <input type="text" className="w-full px-4 py-2 border rounded-md" placeholder="Search..." value={search} onChange={(e) => handleSearch(e.target.value)} />
          }
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <select 
            value={category} 
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 px-3 py-2 border"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <select 
            value={resourceType} 
            onChange={(e) => { setResourceType(e.target.value); setPage(1); }}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 px-3 py-2 border"
          >
            {ResourceTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <input 
            type="text" 
            placeholder="Subject" 
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setPage(1); }}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 px-3 py-2 border"
          />

          <input 
            type="text" 
            placeholder="Tag" 
            value={tag}
            onChange={(e) => { setTag(e.target.value); setPage(1); }}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 px-3 py-2 border"
          />
        </div>

        <div className="flex justify-end">
          <button 
            onClick={clearFilters}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Results Section */}
      {loading ? (
        <div className="flex justify-center py-12">
          {LoadingSpinner ? <LoadingSpinner size="lg" /> : <div>Loading...</div>}
        </div>
      ) : resources.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {resources.map(resource => (
              <ResourceCard 
                key={resource.id} 
                resource={resource} 
                isBookmarked={bookmarkedIds.has(resource.id)}
                onBookmarkToggle={handleBookmarkToggle}
              />
            ))}
          </div>
          
          {pagination.pages > 1 && Pagination && (
            <div className="flex justify-center">
              <Pagination 
                currentPage={page} 
                totalPages={pagination.pages} 
                onPageChange={setPage} 
              />
            </div>
          )}
        </>
      ) : (
        <div className="py-12">
          {EmptyState ? (
            <EmptyState 
              title="No resources found" 
              message="Try adjusting your search or filters to find what you're looking for." 
            />
          ) : (
            <div className="text-center text-gray-500">No resources found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResourcesPage;
