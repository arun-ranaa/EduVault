import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineArrowPath } from 'react-icons/hi2';
import { authAPI } from '../../services/api';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const verify = async () => {
      if (!token) {
        setStatus('error');
        setMessage('No verification token found. Please use the link from your email.');
        return;
      }
      try {
        const res = await authAPI.verifyEmail(token);
        setMessage(res.data?.message || 'Email verified successfully!');
        setStatus('success');
      } catch (err) {
        setMessage(err.response?.data?.message || 'Verification failed. The link may have expired.');
        setStatus('error');
      }
    };
    verify();
  }, [token]);

  return (
    <div className="w-full text-center">
      {status === 'loading' && (
        <>
          <div className="flex justify-center mb-6">
            <HiOutlineArrowPath className="w-16 h-16 text-primary-500 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying your email...</h2>
          <p className="text-sm text-gray-500">Please wait a moment.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
              <HiOutlineCheckCircle className="w-12 h-12 text-green-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
          <p className="text-sm text-gray-600 mb-6">{message}</p>
          <Link
            to="/login"
            className="inline-flex justify-center py-2.5 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
          >
            Go to Sign In
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
              <HiOutlineXCircle className="w-12 h-12 text-red-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
          <p className="text-sm text-gray-600 mb-6">{message}</p>
          <div className="flex flex-col gap-3 items-center">
            <Link
              to="/register"
              className="inline-flex justify-center py-2.5 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              Register Again
            </Link>
            <Link to="/login" className="text-sm text-primary-600 hover:text-primary-500 font-medium">
              Back to Sign In
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

export default VerifyEmailPage;
