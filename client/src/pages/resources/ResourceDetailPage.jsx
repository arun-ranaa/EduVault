import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { HiOutlineArrowDownTray, HiOutlineBookmark, HiBookmark, HiOutlineTrash, HiArrowLeft } from 'react-icons/hi2';
import { resourceAPI, bookmarkAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatFileSize, formatDate, getResourceTypeLabel, getResourceTypeColor } from '../../utils/helpers';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmModal from '../../components/common/ConfirmModal';
import FileTypeIcon from '../../components/common/FileTypeIcon';
import toast from 'react-hot-toast';

const ResourceDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth() || {};
  
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  useEffect(() => {
    fetchResourceDetails();
  }, [id]);

  const fetchResourceDetails = async () => {
    setLoading(true);
    try {
      const res = await resourceAPI.getById(id);
      const resourceData = res.data?.data || res.data;
      setResource(resourceData);
      
      // Check bookmark status
      if (user) {
        try {
          const bookmarkRes = await bookmarkAPI.check(id);
          setIsBookmarked(bookmarkRes.data?.data?.isBookmarked || bookmarkRes.data?.isBookmarked);
        } catch (err) {
          console.error('Failed to check bookmark status', err);
        }
      }
    } catch (error) {
      console.error('Failed to fetch resource:', error);
      toast.error('Resource not found');
      navigate('/resources');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await resourceAPI.getDownloadUrl(id);
      const downloadUrl = res.data?.data?.downloadUrl || res.data?.downloadUrl;
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
        setResource(prev => ({ ...prev, downloadCount: (prev.downloadCount || 0) + 1 }));
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to initiate download');
    }
  };

  const handleBookmarkToggle = async () => {
    if (!user) {
      toast.error('Please login to bookmark resources');
      return;
    }
    try {
      if (isBookmarked) {
        await bookmarkAPI.remove(id);
        setIsBookmarked(false);
        toast.success('Removed from bookmarks');
      } else {
        await bookmarkAPI.add(id);
        setIsBookmarked(true);
        toast.success('Added to bookmarks');
      }
    } catch (error) {
      console.error('Bookmark toggle error:', error);
      toast.error('Failed to update bookmark');
    }
  };

  const handleDelete = async () => {
    try {
      await resourceAPI.delete(id);
      toast.success('Resource deleted successfully');
      navigate('/resources');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete resource');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        {LoadingSpinner ? <LoadingSpinner size="xl" /> : <div>Loading...</div>}
      </div>
    );
  }

  if (!resource) return null;

  const isUploader = user && resource.uploadedBy && (user.id === resource.uploadedBy.id);
  const canDelete = isAdmin || isUploader;
  
  const typeColor = getResourceTypeColor ? getResourceTypeColor(resource.resourceType) : 'bg-blue-100 text-blue-800';
  const typeLabel = getResourceTypeLabel ? getResourceTypeLabel(resource.resourceType) : resource.resourceType;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link to="/resources" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <HiArrowLeft className="w-4 h-4 mr-1" />
        Back to Resources
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${typeColor}`}>
                  {typeLabel}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                  {resource.fileType || 'FILE'}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{resource.title}</h1>
              
              {resource.description && (
                <div className="text-gray-600 space-y-4">
                  {resource.description.split('\n').map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-3 min-w-[200px]">
              <button
                onClick={handleDownload}
                className="flex items-center justify-center w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
              >
                <HiOutlineArrowDownTray className="w-5 h-5 mr-2" />
                Download
              </button>
              
              <button
                onClick={handleBookmarkToggle}
                className={`flex items-center justify-center w-full px-4 py-2 border rounded-lg transition-colors font-medium ${
                  isBookmarked 
                    ? 'bg-primary-50 border-primary-200 text-primary-700 hover:bg-primary-100' 
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {isBookmarked ? <HiBookmark className="w-5 h-5 mr-2" /> : <HiOutlineBookmark className="w-5 h-5 mr-2" />}
                {isBookmarked ? 'Bookmarked' : 'Bookmark'}
              </button>
              
              {canDelete && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center justify-center w-full px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium"
                >
                  <HiOutlineTrash className="w-5 h-5 mr-2" />
                  Delete
                </button>
              )}
            </div>
          </div>

          <hr className="border-gray-100 mb-8" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 mb-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Resource Details</h3>
              <dl className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-gray-500 font-medium">Subject</dt>
                  <dd className="col-span-2 text-gray-900">{resource.subject || 'N/A'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-gray-500 font-medium">Category</dt>
                  <dd className="col-span-2 text-gray-900">{resource.category?.name || 'N/A'}</dd>
                </div>
                {resource.semester && (
                  <div className="grid grid-cols-3 gap-4">
                    <dt className="text-gray-500 font-medium">Semester</dt>
                    <dd className="col-span-2 text-gray-900">{resource.semester}</dd>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-gray-500 font-medium">Tags</dt>
                  <dd className="col-span-2">
                    <div className="flex flex-wrap gap-2">
                      {resource.tags?.length > 0 ? (
                        resource.tags.map((tagObj, idx) => (
                          <span key={idx} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {tagObj.tag?.name || tagObj.name || tagObj}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic">No tags</span>
                      )}
                    </div>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">File Information</h3>
              <dl className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-gray-500 font-medium">File Name</dt>
                  <dd className="col-span-2 text-gray-900 truncate" title={resource.fileName}>{resource.fileName}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-gray-500 font-medium">Size</dt>
                  <dd className="col-span-2 text-gray-900">{formatFileSize ? formatFileSize(resource.fileSize) : `${Math.round(resource.fileSize / 1024)} KB`}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-gray-500 font-medium">Uploaded By</dt>
                  <dd className="col-span-2 text-gray-900 font-medium">{resource.uploadedBy?.name || 'Unknown User'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-gray-500 font-medium">Upload Date</dt>
                  <dd className="col-span-2 text-gray-900">{formatDate ? formatDate(resource.createdAt) : new Date(resource.createdAt).toLocaleDateString()}</dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-gray-500 font-medium">Downloads</dt>
                  <dd className="col-span-2 text-gray-900">{resource.downloadCount || 0}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {ConfirmModal && (
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete Resource"
          message="Are you sure you want to delete this resource? This action cannot be undone."
          confirmText="Delete"
          confirmStyle="danger"
        />
      )}
    </div>
  );
};

export default ResourceDetailPage;
