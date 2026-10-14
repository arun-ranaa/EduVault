import React from 'react';
import { calculateStoragePercentage, formatFileSize } from '../../utils/helpers';

export default function StorageUsage({ used, total }) {
  const percentage = calculateStoragePercentage(used, total);
  
  let colorClass = 'bg-green-500';
  if (percentage >= 80) {
    colorClass = 'bg-red-500';
  } else if (percentage >= 50) {
    colorClass = 'bg-yellow-500';
  }

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">Storage Usage</span>
        <span className="font-medium text-gray-900">{formatFileSize(used)} / {formatFileSize(total)}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div className={`h-2.5 rounded-full ${colorClass}`} style={{ width: `${percentage}%` }}></div>
      </div>
      <div className="mt-1 text-xs text-gray-500 text-right">
        {percentage}% used
      </div>
    </div>
  );
}
