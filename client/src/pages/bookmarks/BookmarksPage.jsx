import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HiBookmark } from 'react-icons/hi2';
import { bookmarkAPI } from '../../services/api';
import ResourceCard from '../../components/resources/ResourceCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';

const BookmarksPage = () => {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, pages: 1 });
  const [page, setPage] = useState(1);
  const limit = 12;

  useEffect(() => {
    fetchBookmarks();
  }, [page]);

  const fetchBookmarks = async () => {
    setLoading(true);
    try {
      const response = await bookmarkAPI.getAll({ page, limit });
      const data = response.data?.data || [];
      setBookmarks(data);
      setPagination({
        page: response.data?.pagination?.page || page,
        limit: response.data?.pagination?.limit || limit,
        pages: response.data?.pagination?.pages || 1
      });
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
      toast.error('Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  };

  const handleBookmarkToggle = async (resourceId) => {
    try {
      await bookmarkAPI.remove(resourceId);
      setBookmarks(prev => prev.filter(b => b.resource?.id !== resourceId && b.resourceId !== resourceId));
      toast.success('Removed from bookmarks');
      
      // If we remove the last item on a page > 1, go back one page
      if (bookmarks.length === 1 && page > 1) {
        setPage(page - 1);
      }
    } catch (error) {
      console.error('Bookmark remove error:', error);
      toast.error('Failed to remove bookmark');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-primary-100 text-primary-600 rounded-xl">
          <HiBookmark className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Bookmarks</h1>
          <p className="text-gray-600 mt-1">Resources you've saved for later.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          {LoadingSpinner ? <LoadingSpinner size="lg" /> : <div>Loading...</div>}
        </div>
      ) : bookmarks.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {bookmarks.map((bookmark) => {
              const resource = bookmark.resource;
              if (!resource) return null;
              
              return (
                <ResourceCard 
                  key={resource.id} 
                  resource={resource} 
                  isBookmarked={true}
                  onBookmarkToggle={handleBookmarkToggle}
                />
              );
            })}
          </div>
          
          {pagination.pages > 1 && Pagination && (
            <div className="flex justify-center mt-8">
              <Pagination 
                currentPage={page} 
                totalPages={pagination.pages} 
                onPageChange={setPage} 
              />
            </div>
          )}
        </>
      ) : (
        <div className="py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
          {EmptyState ? (
            <EmptyState 
              title="No bookmarks yet" 
              message="Browse resources and bookmark the ones you find useful!" 
              action={
                <Link to="/resources" className="inline-flex items-center px-4 py-2 mt-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium transition-colors">
                  Browse Resources
                </Link>
              }
            />
          ) : (
            <div className="text-center py-16">
              <HiBookmark className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bookmarks yet</h3>
              <p className="text-gray-500 mb-6">Browse resources and bookmark the ones you find useful!</p>
              <Link to="/resources" className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium transition-colors">
                Browse Resources
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BookmarksPage;
