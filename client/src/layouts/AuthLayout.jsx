import React from 'react';
import { Outlet } from 'react-router-dom';
import { FaGraduationCap } from 'react-icons/fa';
import { HiOutlineShare, HiOutlineLockClosed, HiOutlineSquares2X2 } from 'react-icons/hi2';

const AuthLayout = () => {
  return (
    <div className="min-h-screen flex w-full">
      {/* Left side - Branding (Hidden on small screens) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 text-white p-12 flex-col justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-12">
            <FaGraduationCap className="h-10 w-10 text-white" />
            <span className="text-3xl font-bold tracking-tight">EduVault</span>
          </div>
          <h1 className="text-4xl font-extrabold mb-4 leading-tight">
            Academic Resource Sharing & Personal Storage
          </h1>
          <p className="text-primary-100 text-lg max-w-md">
            Join the community of students and educators sharing knowledge and keeping important files secure.
          </p>
        </div>

        <div className="space-y-8">
          <div className="flex items-start space-x-4">
            <div className="bg-primary-500/30 p-3 rounded-lg">
              <HiOutlineShare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-xl">Share & Discover Resources</h3>
              <p className="text-primary-100 mt-1">Access study materials, notes, and past papers from your peers.</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="bg-primary-500/30 p-3 rounded-lg">
              <HiOutlineLockClosed className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-xl">Personal Cloud Vault</h3>
              <p className="text-primary-100 mt-1">Keep your private academic files secure in your encrypted vault.</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-4">
            <div className="bg-primary-500/30 p-3 rounded-lg">
              <HiOutlineSquares2X2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-xl">Secure & Organized</h3>
              <p className="text-primary-100 mt-1">Everything you need organized by course, year, and subject.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center space-x-2 mb-8 text-primary-600">
            <FaGraduationCap className="h-8 w-8" />
            <span className="text-2xl font-bold">EduVault</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
