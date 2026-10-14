import React from 'react';
import {
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFilePowerpoint,
  FaFileImage,
  FaFileAlt,
  FaFile,
} from 'react-icons/fa';
import { getFileIcon } from '../../utils/helpers';

export default function FileTypeIcon({ fileType, size = 'md' }) {
  const iconType = getFileIcon(fileType);
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };
  
  const className = sizeClasses[size] || sizeClasses.md;

  switch (iconType) {
    case 'pdf':
      return <FaFilePdf className={`${className} text-red-500`} />;
    case 'doc':
      return <FaFileWord className={`${className} text-blue-500`} />;
    case 'xls':
      return <FaFileExcel className={`${className} text-green-500`} />;
    case 'ppt':
      return <FaFilePowerpoint className={`${className} text-orange-500`} />;
    case 'image':
      return <FaFileImage className={`${className} text-purple-500`} />;
    case 'txt':
      return <FaFileAlt className={`${className} text-gray-500`} />;
    default:
      return <FaFile className={`${className} text-gray-400`} />;
  }
}
