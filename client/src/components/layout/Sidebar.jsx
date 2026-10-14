import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import StorageUsage from '../common/StorageUsage';
import { userAPI } from '../../services/api';
import {
  HiOutlineHome,
  HiOutlineBookOpen,
  HiOutlineCloudArrowUp,
  HiOutlineBookmark,
  HiOutlineLockClosed,
  HiOutlineUser,
  HiOutlineCog,
  HiOutlineUsers,
  HiOutlineTag,
  HiOutlineCircleStack,
  HiOutlineClock,
  HiOutlineGlobeAlt
} from 'react-icons/hi2';

const Sidebar = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [storageData, setStorageData] = useState(null);

  useEffect(() => {
    if (!isAdmin && user) {
      const fetchStorage = async () => {
        try {
          const res = await userAPI.getStorage();
          setStorageData(res.data.data);
        } catch (error) {
          console.error('Failed to fetch storage', error);
        }
      };
      fetchStorage();
    }
  }, [isAdmin, user]);

  const userLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: HiOutlineHome, end: true },
    { to: '/resources', label: 'Resources', icon: HiOutlineBookOpen, end: true },
    { to: '/upload', label: 'Upload Resource', icon: HiOutlineCloudArrowUp, end: false },
    { to: '/bookmarks', label: 'My Bookmarks', icon: HiOutlineBookmark, end: false },
    { to: '/vault', label: 'My Vault', icon: HiOutlineLockClosed, end: false },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Dashboard', icon: HiOutlineHome, end: true },
    { to: '/admin/resources', label: 'Resources', icon: HiOutlineBookOpen, end: false },
    { to: '/admin/users', label: 'Users', icon: HiOutlineUsers, end: false },
    { to: '/admin/categories', label: 'Categories', icon: HiOutlineTag, end: false },
    { to: '/admin/storage', label: 'Storage', icon: HiOutlineCircleStack, end: false },
    { to: '/admin/activity', label: 'Activity', icon: HiOutlineClock, end: false },
  ];

  const bottomUserLinks = [
    { to: '/profile', label: 'Profile', icon: HiOutlineUser, end: false },
    { to: '/settings', label: 'Settings', icon: HiOutlineCog, end: false },
  ];

  const bottomAdminLinks = [
    { to: '/resources', label: 'Resources (Public)', icon: HiOutlineGlobeAlt, end: true },
    { to: '/settings', label: 'Settings', icon: HiOutlineCog, end: false },
  ];

  const renderLinks = (links) => {
    return links.map((link) => {
      const Icon = link.icon;
      return (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            `flex items-center px-4 py-3 mb-1 text-sm font-medium rounded-r-lg transition-colors border-l-4 ${
              isActive
                ? 'bg-primary-50 text-primary-700 border-primary-600'
                : 'text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-900'
            }`
          }
        >
          <Icon className="mr-3 h-5 w-5" />
          {link.label}
        </NavLink>
      );
    });
  };

  return (
    <aside className="fixed top-16 left-0 w-64 h-[calc(100vh-64px)] bg-white border-r border-gray-200 overflow-y-auto flex flex-col z-40">
      <div className="py-4 pr-4 flex-1">
        <nav className="space-y-1">
          {renderLinks(isAdmin ? adminLinks : userLinks)}
        </nav>
        
        <div className="mt-8 pt-4 border-t border-gray-200">
          <nav className="space-y-1">
            {renderLinks(isAdmin ? bottomAdminLinks : bottomUserLinks)}
          </nav>
        </div>
      </div>
      
      {!isAdmin && storageData && (
        <div className="p-4 border-t border-gray-200 mt-auto">
          <StorageUsage used={storageData.used} total={storageData.quota} />
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
