import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineDocumentPlus, HiXMark, HiOutlineCloudArrowUp } from 'react-icons/hi2';
import { resourceAPI, adminAPI, uploadToS3 } from '../../services/api';
import { formatFileSize } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ResourceTypes = [
  { value: 'NOTES', label: 'Notes' },
  { value: 'BOOK', label: 'Book' },
  { value: 'QUESTION_PAPER', label: 'Question Paper' },
  { value: 'ASSIGNMENT', label: 'Assignment' },
  { value: 'STUDY_MATERIAL', label: 'Study Material' },
  { value: 'QUESTION_BANK', label: 'Question Bank' },
  { value: 'LAB_RESOURCE', label: 'Lab Resource' },
  { value: 'OTHER', label: 'Other' }
];

const Semesters = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const UploadResourcePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    resourceType: 'NOTES',
    categoryId: '',
    subject: '',
    semester: ''
  });
  
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchCategories();
  }, []);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags(prev => [...prev, tagInput.trim().toLowerCase()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds the 50MB limit');
      return;
    }
    
    setFile(selectedFile);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) return toast.error('Title is required');
    if (!formData.resourceType) return toast.error('Resource type is required');
    if (tags.length === 0) return toast.error('At least one tag is required');
    if (!file) return toast.error('Please select a file to upload');

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      // 1. Get presigned URL
      const fileType = file.type || file.name.split('.').pop() || 'application/octet-stream';
      
      const presignData = {
        title: formData.title,
        fileName: file.name,
        fileSize: file.size,
        fileType: fileType,
        resourceType: formData.resourceType,
        tags
      };
      
      const presignRes = await resourceAPI.presign(presignData);
      const { uploadUrl, s3Key } = presignRes.data?.data || presignRes.data || {};
      
      if (!uploadUrl || !s3Key) {
        throw new Error('Failed to get upload credentials');
      }

      // 2. Upload directly to S3
      await uploadToS3(uploadUrl, file, (progress) => {
        setUploadProgress(Math.round((progress.loaded * 100) / progress.total));
      });

      // 3. Complete resource creation in backend
      const completeData = {
        ...formData,
        tags,
        fileName: file.name,
        fileType: fileType,
        fileSize: file.size,
        s3Key
      };
      
      await resourceAPI.complete(completeData);
      
      toast.success('Resource uploaded successfully! It is now available for everyone.');
      navigate('/resources');
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to upload resource');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Academic Resource</h1>
        <p className="text-gray-600">Share academic resources with the EduVault community.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Data Structures Midterm Notes"
                className="w-full px-4 py-2 rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                placeholder="Provide a brief description of the resource..."
                className="w-full px-4 py-2 rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Resource Type <span className="text-red-500">*</span>
              </label>
              <select
                name="resourceType"
                value={formData.resourceType}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                required
              >
                {ResourceTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Subject</label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="e.g. Computer Science"
                className="w-full px-4 py-2 rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Semester</label>
              <select
                name="semester"
                value={formData.semester}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Select Semester</option>
                {Semesters.map(sem => (
                  <option key={sem} value={sem}>{sem} Semester</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Tags <span className="text-red-500">*</span> <span className="text-gray-400 font-normal text-xs">(min. 1 required)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(e); } }}
                placeholder="Add tags (e.g. python, algorithms)"
                className="flex-1 px-4 py-2 rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 border border-gray-300 transition-colors"
              >
                Add
              </button>
            </div>
            
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map((t, idx) => (
                  <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-50 text-primary-700 border border-primary-200">
                    {t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="ml-2 text-primary-500 hover:text-primary-700 focus:outline-none"
                    >
                      <HiXMark className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="space-y-2 pt-4">
            <label className="block text-sm font-medium text-gray-700">
              File <span className="text-red-500">*</span>
            </label>
            
            <div
              className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors ${
                isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              }`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="space-y-1 text-center cursor-pointer">
                {file ? (
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-green-100 text-green-600 rounded-full mb-2">
                      <HiOutlineDocumentPlus className="w-8 h-8" />
                    </div>
                    <div className="text-sm font-medium text-gray-900">{file.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatFileSize ? formatFileSize(file.size) : `${Math.round(file.size / 1024)} KB`} • {file.type || 'Unknown type'}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <>
                    <HiOutlineCloudArrowUp className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600 justify-center">
                      <span className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                        Upload a file
                      </span>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PDF, PPT, DOC, DOCX, ZIP up to 50MB</p>
                  </>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
              />
            </div>
          </div>

          {/* Upload Progress */}
          {isSubmitting && (
            <div className="pt-4">
              <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-6 border-t border-gray-200 flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/resources')}
              className="px-5 py-2 mr-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`inline-flex justify-center px-5 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Uploading...' : 'Upload Resource'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default UploadResourcePage;
