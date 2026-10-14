import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { HiOutlineArrowLeft, HiOutlineArrowDownTray, HiOutlineTrash, HiOutlineClock, HiOutlineFolder } from 'react-icons/hi2';
import { vaultAPI } from '../../services/api';
import { formatFileSize, formatDate, formatDateTime } from '../../utils/helpers';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmModal from '../../components/common/ConfirmModal';
import FileTypeIcon from '../../components/common/FileTypeIcon';
import toast from 'react-hot-toast';

const VaultFileDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const res = await vaultAPI.getById(id);
        setFile(res.data?.data || res.data);
      } catch (err) {
        console.error(err);
        setError(true);
        toast.error('Failed to load file details');
      } finally {
        setLoading(false);
      }
    };
    fetchFile();
  }, [id]);

  const handleDownload = async () => {
    try {
      const res = await vaultAPI.getDownloadUrl(id);
      const url = res.data?.data?.downloadUrl || res.data?.downloadUrl;
      if (url) {
        window.open(url, '_blank');
      }
    } catch (err) {
      toast.error('Failed to get download link');
    }
  };

  const handleDelete = async () => {
    try {
      await vaultAPI.delete(id);
      toast.success('File deleted successfully');
      navigate('/vault');
    } catch (err) {
      toast.error('Failed to delete file');
      setDeleteModalOpen(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;
  if (error || !file) return (
    <div className="container mx-auto px-4 py-16 text-center max-w-2xl">
      <h2 className="text-2xl font-bold mb-4">File Not Found</h2>
      <p className="text-gray-600 mb-8">The file you're looking for doesn't exist or you don't have access to it.</p>
      <Link to="/vault" className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700">Return to Vault</Link>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link to="/vault" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary-600 transition-colors mb-6 font-medium">
        <HiOutlineArrowLeft /> Back to Vault
      </Link>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 md:p-12 flex flex-col md:flex-row gap-8 items-start">
          <div className="flex-shrink-0 bg-gray-50 p-8 rounded-2xl border border-gray-100 flex items-center justify-center w-40 h-40">
            <FileTypeIcon type={file.fileType} />
          </div>
          
          <div className="flex-1 w-full">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 break-all">{file.name}</h1>
            {file.fileName !== file.name && (
              <p className="text-gray-500 mb-4 text-sm font-mono break-all">Original: {file.fileName}</p>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 my-8">
              <div>
                <p className="text-sm text-gray-500 mb-1">Size</p>
                <p className="font-medium text-gray-900">{formatFileSize(file.fileSize)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Type</p>
                <p className="font-medium text-gray-900 truncate">{file.fileType || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Folder</p>
                <div className="flex items-center gap-1.5 font-medium text-gray-900">
                  <HiOutlineFolder className="text-gray-400" />
                  {file.folder || '/'}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Uploaded On</p>
                <div className="flex items-center gap-1.5 font-medium text-gray-900">
                  <HiOutlineClock className="text-gray-400" />
                  {formatDateTime ? formatDateTime(file.createdAt) : new Date(file.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-100">
              <button onClick={handleDownload} className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 flex items-center gap-2 px-6">
                <HiOutlineArrowDownTray className="w-5 h-5" /> Download File
              </button>
              <button onClick={() => setDeleteModalOpen(true)} className="inline-flex justify-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-transparent rounded-md shadow-sm hover:bg-red-100 flex items-center gap-2 px-6">
                <HiOutlineTrash className="w-5 h-5" /> Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete File"
        message={`Are you sure you want to delete "${file.name}"? This action cannot be undone.`}
        confirmText="Delete File"
        confirmStyle="danger"
      />
    </div>
  );
};

export default VaultFileDetailPage;
