import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Search,
  Filter,
  Eye,
  X,
  AlertCircle,
  Building2,
  RefreshCw,
  ChevronDown,
  Calendar,
  Tag,
  User,
  Image,
  MessageSquare,
} from "lucide-react";

const AdminDashboard = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [remarks, setRemarks] = useState("");

  const departments = [
    { value: "academic", label: "Academic Affairs" },
    { value: "facilities", label: "Facilities Management" },
    { value: "finance", label: "Finance Office" },
    { value: "hr", label: "Human Resources" },
    { value: "security", label: "Security Office" },
    { value: "registrar", label: "Registrar" },
    { value: "student_affairs", label: "Student Affairs" },
  ];

  const statusConfig = {
    submitted: {
      label: "Submitted",
      color: "bg-blue-100 text-blue-800",
      icon: FileText,
    },
    verified: {
      label: "Verified",
      color: "bg-gold-100 text-gold-800",
      icon: CheckCircle,
    },
    rejected: {
      label: "Rejected",
      color: "bg-red-100 text-red-800",
      icon: XCircle,
    },
    in_progress: {
      label: "In Progress",
      color: "bg-orange-100 text-orange-800",
      icon: Clock,
    },
    resolved: {
      label: "Resolved",
      color: "bg-green-100 text-green-800",
      icon: CheckCircle,
    },
  };

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("complaints")
        .select("*, complaint_attachments(*)")
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setComplaints(data || []);
    } catch (err) {
      console.error("Error fetching complaints:", err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleApprove = async () => {
    if (!selectedDepartment) {
      alert("Please select a department");
      return;
    }

    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("complaints")
        .update({
          status: "verified",
          assigned_department: selectedDepartment,
          admin_remarks: remarks,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq("id", selectedComplaint.id);

      if (updateError) throw updateError;

      await supabase.from("audit_trail").insert({
        complaint_id: selectedComplaint.id,
        action: "Feedback Verified",
        performed_by: user.id,
        details: `Assigned to ${
          departments.find((d) => d.value === selectedDepartment)?.label
        }. ${remarks ? `Remarks: ${remarks}` : ""}`,
      });

      setShowModal(false);
      setSelectedComplaint(null);
      setSelectedDepartment("");
      setRemarks("");
      fetchComplaints();
    } catch (err) {
      console.error("Error approving feedback:", err);
      alert("Failed to approve feedback");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!remarks) {
      alert("Please provide a reason for rejection");
      return;
    }

    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("complaints")
        .update({
          status: "rejected",
          admin_remarks: remarks,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq("id", selectedComplaint.id);

      if (updateError) throw updateError;

      await supabase.from("audit_trail").insert({
        complaint_id: selectedComplaint.id,
        action: "Feedback Rejected",
        performed_by: user.id,
        details: `Reason: ${remarks}`,
      });

      setShowModal(false);
      setSelectedComplaint(null);
      setRemarks("");
      fetchComplaints();
    } catch (err) {
      console.error("Error rejecting feedback:", err);
      alert("Failed to reject feedback");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAttachments = (complaint) => {
    if (complaint?.complaint_attachments?.length > 0) {
      return complaint.complaint_attachments;
    }
    if (complaint?.attachment_url) {
      return [{ attachment_url: complaint.attachment_url }];
    }
    return [];
  };

  const hasAttachments = (complaint) => getAttachments(complaint).length > 0;

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "academic", label: "Academic" },
    { value: "facilities", label: "Facilities" },
    { value: "finance", label: "Finance" },
    { value: "staff", label: "Staff" },
    { value: "security", label: "Security" },
    { value: "other", label: "Other" },
  ];

  const dateRanges = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
  ];

  const isWithinDateRange = (dateString) => {
    if (filterDateRange === "all") return true;
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filterDateRange === "today") {
      return date >= today;
    } else if (filterDateRange === "week") {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    } else if (filterDateRange === "month") {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return date >= monthAgo;
    }
    return true;
  };

  const filteredComplaints = complaints.filter((complaint) => {
    const matchesSearch =
      !searchQuery ||
      complaint.reference_number
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      complaint.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      complaint.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      complaint.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      filterCategory === "all" || complaint.category === filterCategory;
    const matchesDate = isWithinDateRange(complaint.created_at);

    return matchesSearch && matchesCategory && matchesDate;
  });

  const stats = {
    total: complaints.length,
    submitted: complaints.filter((c) => c.status === "submitted").length,
    verified: complaints.filter((c) => c.status === "verified").length,
    inProgress: complaints.filter((c) => c.status === "in_progress").length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
    rejected: complaints.filter((c) => c.status === "rejected").length,
  };

  return (
    <div className="min-h-[calc(100vh-200px)] py-8 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 bg-maroon-800 rounded-xl flex items-center justify-center">
              <Shield size={24} className="text-gold-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Admin Dashboard
              </h1>
              <p className="text-gray-600">Verify and manage complaints</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
            <p className="text-sm text-blue-600">Pending</p>
            <p className="text-2xl font-bold text-blue-700">
              {stats.submitted}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gold-100 shadow-sm">
            <p className="text-sm text-gold-600">Verified</p>
            <p className="text-2xl font-bold text-gold-700">{stats.verified}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-orange-100 shadow-sm">
            <p className="text-sm text-orange-600">In Progress</p>
            <p className="text-2xl font-bold text-orange-700">
              {stats.inProgress}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-green-100 shadow-sm">
            <p className="text-sm text-green-600">Resolved</p>
            <p className="text-2xl font-bold text-green-700">
              {stats.resolved}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm">
            <p className="text-sm text-red-600">Rejected</p>
            <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-6">
          <div className="flex flex-col gap-4">
            {/* Search Row */}
            <div className="relative">
              <Search
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by reference, name, category, description..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none"
              />
            </div>
            {/* Filter Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <Filter size={18} className="text-gray-400" />
                <span className="text-sm text-gray-500">Filters:</span>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none bg-white text-sm"
              >
                <option value="all">All Status</option>
                <option value="submitted">Pending</option>
                <option value="verified">Verified</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none bg-white text-sm"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <select
                value={filterDateRange}
                onChange={(e) => setFilterDateRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none bg-white text-sm"
              >
                {dateRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchComplaints}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={18} className="text-gray-600" />
              </button>
              <span className="text-sm text-gray-500 ml-auto">
                {filteredComplaints.length} feedback
                {filteredComplaints.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Complaints Newsfeed */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-maroon-800 border-t-transparent mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading complaints...</p>
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
              <FileText size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No complaints found</p>
            </div>
          ) : (
            filteredComplaints.map((complaint) => {
              const status = statusConfig[complaint.status];
              const StatusIcon = status?.icon || FileText;
              return (
                <div
                  key={complaint.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-maroon-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User size={20} className="text-maroon-800" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {complaint.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {complaint.email || "No email provided"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium self-start sm:self-center ${status?.color}`}
                    >
                      <StatusIcon size={14} />
                      <span>{status?.label}</span>
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="px-4 sm:px-6 py-4">
                    {/* Reference & Category */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-maroon-50 text-maroon-800 rounded-lg text-xs font-mono font-medium">
                        <FileText size={12} />
                        <span className="truncate max-w-[120px] sm:max-w-none">
                          {complaint.reference_number}
                        </span>
                      </span>
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs capitalize">
                        <Tag size={12} />
                        <span>{complaint.category}</span>
                      </span>
                      <span className="inline-flex items-center space-x-1.5 text-xs text-gray-500">
                        <Calendar size={12} />
                        <span>{formatDate(complaint.created_at)}</span>
                      </span>
                    </div>

                    {/* Description Preview */}
                    <div className="mb-4">
                      <p className="text-gray-700 line-clamp-2 text-sm sm:text-base">
                        {complaint.description}
                      </p>
                    </div>

                    {/* Attachment indicator */}
                    {hasAttachments(complaint) && (
                      <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
                        <Image size={16} />
                        <span>Has attachment</span>
                      </div>
                    )}

                    {/* Assigned Department (if verified) */}
                    {complaint.assigned_department && (
                      <div className="flex items-center space-x-2 text-sm text-gold-700 bg-gold-50 px-3 py-2 rounded-lg mb-4">
                        <Building2 size={16} />
                        <span className="truncate">
                          Assigned to:{" "}
                          <strong className="capitalize">
                            {complaint.assigned_department.replace("_", " ")}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <MessageSquare size={16} />
                      <span>Complaint #{complaint.id}</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedComplaint(complaint);
                        setShowModal(true);
                      }}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-maroon-800 text-white rounded-lg hover:bg-maroon-700 transition-colors text-sm font-medium w-full sm:w-auto justify-center"
                    >
                      <Eye size={16} />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal */}
        {showModal && selectedComplaint && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Feedback Details
                  </h2>
                  <p className="text-sm text-gray-500 font-mono">
                    {selectedComplaint.reference_number}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedComplaint(null);
                    setSelectedDepartment("");
                    setRemarks("");
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Current Status</span>
                  <span
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                      statusConfig[selectedComplaint.status]?.color
                    }`}
                  >
                    {statusConfig[selectedComplaint.status]?.label}
                  </span>
                </div>

                {/* Info Grid */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Complainant</p>
                    <p className="font-medium text-gray-900">
                      {selectedComplaint.name}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Email</p>
                    <p className="font-medium text-gray-900">
                      {selectedComplaint.email || "Not provided"}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">Category</p>
                    <p className="font-medium text-gray-900 capitalize">
                      {selectedComplaint.category}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500 mb-1">
                      Student/Employee ID
                    </p>
                    <p className="font-medium text-gray-900">
                      {selectedComplaint.student_id || "Not provided"}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <p className="text-sm text-gray-500 mb-2">Description</p>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {selectedComplaint.description}
                    </p>
                  </div>
                </div>

                {/* Feedback Evidence Image */}
                {getAttachments(selectedComplaint).length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">
                      Feedback Evidence
                    </p>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                      {getAttachments(selectedComplaint).map((attachment) => (
                        <div key={attachment.id || attachment.attachment_url}>
                          <img
                            src={attachment.attachment_url}
                            alt="Feedback Evidence"
                            className="max-h-64 rounded-lg border border-gray-200 mb-2 w-full object-contain"
                          />
                          <a
                            href={attachment.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-2 text-maroon-800 hover:text-maroon-600 text-sm"
                          >
                            <Eye size={18} />
                            <span>View Full Image</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Section - Only for submitted complaints */}
                {selectedComplaint.status === "submitted" && (
                  <div className="border-t border-gray-100 pt-6">
                    <h3 className="font-semibold text-gray-900 mb-4">
                      Take Action
                    </h3>

                    {/* Department Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assign to Department
                      </label>
                      <div className="relative">
                        <Building2
                          size={20}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <select
                          value={selectedDepartment}
                          onChange={(e) =>
                            setSelectedDepartment(e.target.value)
                          }
                          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none appearance-none bg-white"
                        >
                          <option value="">Select a department...</option>
                          {departments.map((dept) => (
                            <option key={dept.value} value={dept.value}>
                              {dept.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={20}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                      </div>
                    </div>

                    {/* Remarks */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Remarks{" "}
                        <span className="text-gray-400">
                          (optional for approval, required for rejection)
                        </span>
                      </label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none resize-none"
                        placeholder="Add any remarks or notes..."
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading || !selectedDepartment}
                        className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        ) : (
                          <>
                            <CheckCircle size={20} />
                            <span>Approve & Assign</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={actionLoading || !remarks}
                        className="flex-1 bg-red-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        ) : (
                          <>
                            <XCircle size={20} />
                            <span>Reject</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Show assigned department for verified complaints */}
                {selectedComplaint.assigned_department && (
                  <div className="border-t border-gray-100 pt-6">
                    <div className="bg-gold-50 border border-gold-200 rounded-xl p-4">
                      <p className="text-sm text-gold-700 mb-1">
                        Assigned Department
                      </p>
                      <p className="font-semibold text-gold-900 capitalize">
                        {departments.find(
                          (d) =>
                            d.value === selectedComplaint.assigned_department
                        )?.label || selectedComplaint.assigned_department}
                      </p>
                    </div>
                  </div>
                )}

                {/* Show resolution for resolved complaints */}
                {(selectedComplaint.resolution_details ||
                  selectedComplaint.resolution_image_url) && (
                  <div className="border-t border-gray-100 pt-6 space-y-4">
                    {selectedComplaint.resolution_details && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-sm text-green-700 mb-1">
                          Resolution Details
                        </p>
                        <p className="text-green-900">
                          {selectedComplaint.resolution_details}
                        </p>
                      </div>
                    )}
                    {selectedComplaint.resolution_image_url && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">
                          Resolution Proof
                        </p>
                        <div className="bg-green-50 rounded-xl p-4">
                          <img
                            src={selectedComplaint.resolution_image_url}
                            alt="Resolution Proof"
                            className="max-h-64 rounded-lg border border-green-200 mb-2"
                          />
                          <a
                            href={selectedComplaint.resolution_image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-2 text-green-700 hover:text-green-600 text-sm"
                          >
                            <Eye size={18} />
                            <span>View Full Image</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
