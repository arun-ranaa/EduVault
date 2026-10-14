import React from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineBookmark, HiBookmark, HiOutlineEye, HiOutlineArrowDownTray } from 'react-icons/hi2';
import { formatFileSize, formatDate, getResourceTypeLabel, getResourceTypeColor } from '../../utils/helpers';
import FileTypeIcon from '../common/FileTypeIcon';
import { resourceAPI } from '../../services/api';
import toast from 'react-hot-toast';

const ResourceCard = ({ resource, onBookmarkToggle, isBookmarked }) => {
  const handleDownload = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { downloadUrl } = await resourceAPI.getDownloadUrl(resource._id || resource.id);
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to get download URL');
    }
  };

  const handleBookmark = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onBookmarkToggle) {
      onBookmarkToggle(resource._id || resource.id);
    }
  };

  const tags = resource.tags || [];
  const displayTags = tags.slice(0, 3);
  const extraTags = tags.length > 3 ? tags.length - 3 : 0;
  
  const typeColor = getResourceTypeColor ? getResourceTypeColor(resource.resourceType) : 'bg-blue-100 text-blue-800';
  const typeLabel = getResourceTypeLabel ? getResourceTypeLabel(resource.resourceType) : resource.resourceType;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 flex flex-col h-full">
      <div className="p-5 flex-grow">
        <div className="flex justify-between items-start mb-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>
            {typeLabel}
          </span>
          <div className="text-gray-400">
            {/* Fallback to a generic icon if FileTypeIcon is missing */}
            {FileTypeIcon ? <FileTypeIcon fileType={resource.fileType} fileName={resource.fileName} /> : null}
          </div>
        </div>

        <Link to={`/resources/${resource._id || resource.id}`} className="block group">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 group-hover:text-primary-600 transition-colors">
            {resource.title}
          </h3>
        </Link>

        <div className="mt-2 text-sm text-gray-500 space-y-1">
          {resource.subject && <p>Subject: <span className="font-medium text-gray-700">{resource.subject}</span></p>}
          {resource.category && <p>Category: <span className="font-medium text-gray-700">{resource.category.name || resource.category}</span></p>}
        </div>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {displayTags.map((tag, idx) => (
              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                {tag}
              </span>
            ))}
            {extraTags > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                +{extraTags} more
              </span>
            )}
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between mt-auto rounded-b-xl">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700 truncate max-w-[120px]">
            {resource.uploader?.name || 'Unknown User'}
          </span>
          <span className="text-xs text-gray-500">
            {formatDate ? formatDate(resource.createdAt) : new Date(resource.createdAt).toLocaleDateString()}
          </span>
        </div>
        
        <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
          {formatFileSize ? formatFileSize(resource.fileSize) : `${Math.round(resource.fileSize / 1024)} KB`}
        </span>
      </div>

      <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center bg-white rounded-b-xl">
        <button 
          onClick={handleBookmark}
          className={`p-2 rounded-full transition-colors ${isBookmarked ? 'text-primary-600 bg-primary-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
          title={isBookmarked ? "Remove Bookmark" : "Add Bookmark"}
        >
          {isBookmarked ? <HiBookmark className="w-5 h-5" /> : <HiOutlineBookmark className="w-5 h-5" />}
        </button>

        <div className="flex space-x-2">
          <Link 
            to={`/resources/${resource._id || resource.id}`}
            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
            title="View Details"
          >
            <HiOutlineEye className="w-5 h-5" />
          </Link>
          <button 
            onClick={handleDownload}
            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
            title="Download"
          >
            <HiOutlineArrowDownTray className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResourceCard;
