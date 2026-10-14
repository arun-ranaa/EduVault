import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineLockClosed, HiOutlineFolder, HiOutlineTrash, HiOutlineArrowDownTray, HiOutlineEye, HiOutlineCloudArrowUp, HiXMark } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { vaultAPI, userAPI, uploadToS3 } from '../../services/api';
import { formatFileSize, formatDate, truncateText } from '../../utils/helpers';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import SearchBar from '../../components/common/SearchBar';
import ConfirmModal from '../../components/common/ConfirmModal';
import FileTypeIcon from '../../components/common/FileTypeIcon';
import StorageUsage from '../../components/common/StorageUsage';

const VaultPage = () => {
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [storageInfo, setStorageInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');

  // Modals & States
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  // Upload States
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadFolder, setUploadFolder] = useState('/');
  const [uploadName, setUploadName] = useState('');

  const fetchVaultData = useCallback(async () => {
    try {
      setLoading(true);
      const [filesRes, foldersRes, storageRes] = await Promise.all([
        vaultAPI.getFiles({ page, search: searchQuery, folder: selectedFolder }),
        vaultAPI.getFolders(),
        userAPI.getStorage()
      ]);

      setFiles(filesRes.data?.data || []);
      setTotalPages(filesRes.data?.pagination?.pages || 1);
      setFolders(foldersRes.data?.data || []);
      setStorageInfo(storageRes.data?.data || { used: 0, quota: 0 });
    } catch (error) {
      toast.error('Failed to load vault data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, selectedFolder]);

  useEffect(() => {
    fetchVaultData();
  }, [fetchVaultData]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleFolderSelect = (folder) => {
    setSelectedFolder(folder === selectedFolder ? '' : folder);
    setPage(1);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadName(file.name);
    }
    // Reset so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      // 1. Presign
      const presignRes = await vaultAPI.presign({
        fileName: uploadFile.name,
        fileSize: uploadFile.size,
        fileType: uploadFile.type || 'application/octet-stream',
        folder: uploadFolder
      });
      const { uploadUrl, s3Key } = presignRes.data?.data || presignRes.data;

      if (!uploadUrl) {
        throw new Error('Upload URL not provided');
      }

      // 2. Upload to S3
      await uploadToS3(uploadUrl, uploadFile, (progress) => {
        setUploadProgress(progress);
      });

      // 3. Complete
      await vaultAPI.complete({
        fileName: uploadFile.name,
        fileType: uploadFile.type || 'application/octet-stream',
        fileSize: uploadFile.size,
        s3Key,
        folder: uploadFolder,
        name: uploadName || uploadFile.name
      });

      toast.success('File uploaded successfully!');
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadName('');
      setUploadFolder('/');
      fetchVaultData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
      console.error(error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownload = async (file) => {
    try {
      const res = await vaultAPI.getDownloadUrl(file.id);
      const downloadUrl = res.data?.data?.downloadUrl;
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
      }
    } catch (error) {
      toast.error('Failed to get download link');
    }
  };

  const handleDeleteClick = (file) => {
    setFileToDelete(file);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;
    try {
      await vaultAPI.delete(fileToDelete.id);
      toast.success('File deleted successfully');
      fetchVaultData();
    } catch (error) {
      toast.error('Failed to delete file');
    } finally {
      setDeleteModalOpen(false);
      setFileToDelete(null);
    }
  };

  const openUploadModal = () => {
    setUploadFile(null);
    setUploadName('');
    setUploadFolder('/');
    setUploadModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <HiOutlineLockClosed className="text-3xl text-primary-600" />
          <h1 className="page-header">My Vault</h1>
        </div>
        <button onClick={openUploadModal} className="btn-primary gap-2">
          <HiOutlineCloudArrowUp className="w-5 h-5" /> Upload File
        </button>
      </div>

      {/* Storage Usage */}
      {storageInfo && (
        <div className="card p-4">
          <StorageUsage used={storageInfo.used} total={storageInfo.quota} />
        </div>
      )}

      {/* Filters */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="w-full md:w-1/3">
            <SearchBar onSearch={handleSearch} placeholder="Search files..." />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            <button
              onClick={() => handleFolderSelect('')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!selectedFolder ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All Files
            </button>
            {folders.map(folder => (
              <button
                key={folder}
                onClick={() => handleFolderSelect(folder)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${selectedFolder === folder ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <HiOutlineFolder className="w-4 h-4" /> {folder === '/' ? 'Root' : folder}
              </button>
            ))}
          </div>
        </div>

        {/* File Table */}
        {loading ? (
          <div className="py-12"><LoadingSpinner /></div>
        ) : files.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-sm">
                    <th className="py-3 px-4 font-medium">Name</th>
                    <th className="py-3 px-4 font-medium">Size</th>
                    <th className="py-3 px-4 font-medium hidden sm:table-cell">Folder</th>
                    <th className="py-3 px-4 font-medium hidden md:table-cell">Uploaded</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(file => (
                    <tr key={file.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <FileTypeIcon fileType={file.fileType} />
                          <p className="font-medium text-gray-900 truncate max-w-[200px]" title={file.name}>
                            {truncateText(file.name, 30)}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatFileSize(file.fileSize)}
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span className="badge-gray">{file.folder}</span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-sm text-gray-500">
                        {formatDate(file.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Link to={`/vault/${file.id}`} className="p-2 text-gray-400 hover:text-primary-600 transition-colors" title="View">
                            <HiOutlineEye className="w-5 h-5" />
                          </Link>
                          <button onClick={() => handleDownload(file)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Download">
                            <HiOutlineArrowDownTray className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleDeleteClick(file)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                            <HiOutlineTrash className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<HiOutlineLockClosed className="w-12 h-12 text-gray-300" />}
            title="Your vault is empty"
            message={searchQuery || selectedFolder ? "No files match your filters." : "Upload files to keep them secure in your personal vault."}
            action={!searchQuery && !selectedFolder ? (
              <button onClick={openUploadModal} className="btn-primary mt-4">
                Upload your first file
              </button>
            ) : null}
          />
        )}
      </div>

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Upload to Vault</h2>
              <button onClick={() => { if (!uploading) setUploadModalOpen(false); }} className="text-gray-400 hover:text-gray-600">
                <HiXMark className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {!uploadFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors border-gray-300 hover:border-primary-400 bg-gray-50"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <HiOutlineCloudArrowUp className="mx-auto w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-gray-700 font-medium mb-1">Click to select a file</p>
                  <p className="text-gray-500 text-sm">PDF, DOC, PPT, XLS, TXT, Images — up to 50MB</p>
                </div>
              ) : (
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <FileTypeIcon fileType={uploadFile.type} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{uploadFile.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(uploadFile.size)}</p>
                    </div>
                    {!uploading && (
                      <button type="button" onClick={() => setUploadFile(null)} className="text-red-500 hover:text-red-700 text-sm font-medium">
                        Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display Name (Optional)</label>
                    <input
                      type="text"
                      value={uploadName}
                      onChange={e => setUploadName(e.target.value)}
                      className="input-field"
                      placeholder={uploadFile.name}
                      disabled={uploading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Folder</label>
                    <input
                      type="text"
                      value={uploadFolder}
                      onChange={e => setUploadFolder(e.target.value)}
                      className="input-field"
                      placeholder="e.g. /Documents or /Images"
                      disabled={uploading}
                    />
                  </div>

                  {uploading && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-primary-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-6">
                    <button type="button" onClick={() => setUploadModalOpen(false)} disabled={uploading} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" disabled={uploading} className="btn-primary min-w-[100px]">
                      {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete File"
        message={`Are you sure you want to delete "${fileToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default VaultPage;
