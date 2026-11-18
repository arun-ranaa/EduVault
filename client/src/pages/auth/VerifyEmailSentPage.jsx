import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HiOutlineEnvelope, HiOutlineArrowPath, HiOutlineCheckCircle } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';

const VerifyEmailSentPage = () => {
  const location = useLocation();
  const email = location.state?.email || '';
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) {
      toast.error('No email address found. Please register again.');
      return;
    }
    setResending(true);
    try {
      await authAPI.resendVerification(email);
      setResent(true);
      toast.success('Verification email resent! Check your inbox.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full text-center">
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center">
          <HiOutlineEnvelope className="w-10 h-10 text-primary-600" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
      <p className="text-sm text-gray-600 mb-6">
        We've sent a verification link to{' '}
        {email ? <span className="font-semibold text-gray-800">{email}</span> : 'your email address'}.
        <br />
        Click the link in the email to activate your account.
      </p>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 text-left text-sm text-blue-800">
        <ul className="space-y-1 list-disc list-inside">
          <li>The link expires in <strong>24 hours</strong></li>
          <li>Check your <strong>spam / junk folder</strong> if you don't see it</li>
          <li>Make sure you entered the correct email address</li>
        </ul>
      </div>

      {resent ? (
        <div className="flex items-center justify-center gap-2 text-green-600 font-medium text-sm mb-4">
          <HiOutlineCheckCircle className="w-5 h-5" />
          Email resent successfully!
        </div>
      ) : (
        <button
          onClick={handleResend}
          disabled={resending}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50 mb-4"
        >
          <HiOutlineArrowPath className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
          {resending ? 'Resending...' : "Didn't receive it? Resend email"}
        </button>
      )}

      <div className="mt-4 text-sm text-gray-500">
        <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
          Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmailSentPage;
