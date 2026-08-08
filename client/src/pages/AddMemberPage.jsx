import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import Toast from '../components/common/Toast';
import {
  UserPlus,
  FileText,
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  Mail,
  Phone,
  CreditCard
} from 'lucide-react';

export default function AddMemberPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contact_no_1: '',
    contact_no_2: '',
    aadhaar_id_no: ''
  });

  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [panFile, setPanFile] = useState(null);

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });
  const [createdMember, setCreatedMember] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e, setFile, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        [fieldName]: 'Invalid file type. Only PDF, JPG, JPEG, and PNG files are accepted.'
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        [fieldName]: 'File size exceeds maximum limit of 5MB.'
      }));
      return;
    }

    setFile(file);
    setErrors((prev) => ({ ...prev, [fieldName]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Member full name is required.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.contact_no_1.trim()) {
      newErrors.contact_no_1 = 'Primary contact number is required.';
    } else if (formData.contact_no_1.replace(/\D/g, '').length < 10) {
      newErrors.contact_no_1 = 'Primary contact number must be at least 10 digits.';
    }

    if (!formData.aadhaar_id_no.trim()) {
      newErrors.aadhaar_id_no = 'Aadhaar ID number is required.';
    } else if (formData.aadhaar_id_no.replace(/\D/g, '').length !== 12) {
      newErrors.aadhaar_id_no = 'Aadhaar number must be exactly 12 digits.';
    }

    if (!aadhaarFile) {
      newErrors.aadhaar_document = 'Aadhaar KYC document upload is required.';
    }

    if (!panFile) {
      newErrors.pan_document = 'PAN Card document upload is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setToast({ type: '', message: '' });

    try {
      const data = new FormData();
      data.append('name', formData.name.trim());
      data.append('email', formData.email.trim());
      data.append('contact_no_1', formData.contact_no_1.trim());
      data.append('contact_no_2', formData.contact_no_2 ? formData.contact_no_2.trim() : '');
      data.append('aadhaar_id_no', formData.aadhaar_id_no.trim());
      data.append('aadhaar_document', aadhaarFile);
      data.append('pan_document', panFile);

      const res = await API.post('/members', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setCreatedMember({
          id: res.data.memberId,
          code: res.data.memberCode,
          name: formData.name
        });
        setToast({
          type: 'success',
          message: `Member registered successfully! Assigned Member ID: ${res.data.memberCode}`
        });

        // Reset form
        setFormData({
          name: '',
          email: '',
          contact_no_1: '',
          contact_no_2: '',
          aadhaar_id_no: ''
        });
        setAadhaarFile(null);
        setPanFile(null);
      }
    } catch (err) {
      console.error('Member creation error:', err);
      const msg = err.response?.data?.message || 'Failed to create member record. Please check input values.';
      setToast({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      
      {/* Toast Notification */}
      <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: '', message: '' })} />

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <UserPlus className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">Add New Member & Store KYC</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Register a new chit fund member and securely store Aadhaar and PAN documents.
          </p>
        </div>
      </div>

      {/* Success Banner if member created */}
      {createdMember && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-emerald-900">Member Created Successfully</h4>
              <p className="text-xs text-emerald-700">
                Member Code: <span className="font-mono font-bold">{createdMember.code}</span> ({createdMember.name})
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/members/${createdMember.id}`)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-emerald-500"
          >
            View Profile
          </button>
        </div>
      )}

      {/* Member Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Section 1: Personal & Contact Information */}
        <div className="p-6 border-b border-slate-100 space-y-5">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            1. Personal & Contact Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Member Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Ramesh Kumar"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border ${
                    errors.name ? 'border-rose-500' : 'border-slate-300'
                  } rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="ramesh.k@gmail.com"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border ${
                    errors.email ? 'border-rose-500' : 'border-slate-300'
                  } rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              {errors.email && <p className="text-xs text-rose-500 mt-1">{errors.email}</p>}
            </div>

            {/* Primary Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contact No. 1 (Primary) <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                name="contact_no_1"
                value={formData.contact_no_1}
                onChange={handleInputChange}
                placeholder="9845012345"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border ${
                  errors.contact_no_1 ? 'border-rose-500' : 'border-slate-300'
                } rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {errors.contact_no_1 && <p className="text-xs text-rose-500 mt-1">{errors.contact_no_1}</p>}
            </div>

            {/* Secondary Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contact No. 2 (Alternate)
              </label>
              <input
                type="tel"
                name="contact_no_2"
                value={formData.contact_no_2}
                onChange={handleInputChange}
                placeholder="Optional secondary phone"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: KYC Details & Documents */}
        <div className="p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            2. KYC Details & Secure Document Storage
          </h3>

          {/* Aadhaar Number Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Aadhaar ID Number (12 Digits) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="aadhaar_id_no"
              maxLength={12}
              value={formData.aadhaar_id_no}
              onChange={handleInputChange}
              placeholder="e.g. 458912348901"
              className={`w-full sm:w-1/2 px-3.5 py-2.5 bg-slate-50 border ${
                errors.aadhaar_id_no ? 'border-rose-500' : 'border-slate-300'
              } rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {errors.aadhaar_id_no && <p className="text-xs text-rose-500 mt-1">{errors.aadhaar_id_no}</p>}
          </div>

          {/* Upload Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            
            {/* Aadhaar File Upload Box */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Aadhaar Document Upload (PDF/JPG/PNG) <span className="text-rose-500">*</span>
              </label>

              {aadhaarFile ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 truncate">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{aadhaarFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAadhaarFile(null)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center p-5 border-2 border-dashed ${
                  errors.aadhaar_document ? 'border-rose-300 bg-rose-50/30' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                } rounded-xl cursor-pointer transition`}>
                  <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs font-semibold text-slate-700">Click to upload Aadhaar File</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">PDF, JPG, PNG (Max 5MB)</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, setAadhaarFile, 'aadhaar_document')}
                  />
                </label>
              )}
              {errors.aadhaar_document && <p className="text-xs text-rose-500 mt-1">{errors.aadhaar_document}</p>}
            </div>

            {/* PAN Card File Upload Box */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                PAN Card Document Upload (PDF/JPG/PNG) <span className="text-rose-500">*</span>
              </label>

              {panFile ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 truncate">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{panFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPanFile(null)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center p-5 border-2 border-dashed ${
                  errors.pan_document ? 'border-rose-300 bg-rose-50/30' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                } rounded-xl cursor-pointer transition`}>
                  <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs font-semibold text-slate-700">Click to upload PAN Card File</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">PDF, JPG, PNG (Max 5MB)</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, setPanFile, 'pan_document')}
                  />
                </label>
              )}
              {errors.pan_document && <p className="text-xs text-rose-500 mt-1">{errors.pan_document}</p>}
            </div>

          </div>
        </div>

        {/* Submit Footer Bar */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/members')}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating Member...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>CREATE MEMBER</span>
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
}
