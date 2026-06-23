import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Building2,
  CheckCircle,
  Clock,
  FileText,
  Search,
  Filter,
  Eye,
  X,
  RefreshCw,
  PlayCircle,
  MessageSquare,
  Upload,
  Image,
  Calendar,
  Tag,
  User,
} from "lucide-react";

const DepartmentDashboard = () => {
  const { user, userDepartment } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [resolutionDetails, setResolutionDetails] = useState("");
  const [departmentRemarks, setDepartmentRemarks] = useState("");
  const [resolutionImage, setResolutionImage] = useState(null);
  const [imageError, setImageError] = useState("");

  const departmentLabels = {
    academic: "Academic Affairs",
    facilities: "Facilities Management",
    finance: "Finance Office",
    hr: "Human Resources",
    security: "Security Office",
    registrar: "Registrar",
    student_affairs: "Student Affairs",
  };

  const statusConfig = {
    verified: {
      label: "Pending",
      color: "bg-gold-100 text-gold-800",
      icon: Clock,
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
        .eq("assigned_department", userDepartment)
        .in("status", ["verified", "in_progress", "resolved"])
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
  }, [filterStatus, userDepartment]);

  useEffect(() => {
    if (userDepartment) {
      fetchComplaints();
    }
  }, [userDepartment, fetchComplaints]);

  const handleStartProgress = async () => {
    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("complaints")
        .update({
          status: "in_progress",
          department_remarks: departmentRemarks,
          started_at: new Date().toISOString(),
          started_by: user.id,
        })
        .eq("id", selectedComplaint.id);

      if (updateError) throw updateError;

      await supabase.from("audit_trail").insert({
        complaint_id: selectedComplaint.id,
        action: "Started Processing",
        performed_by: user.id,
        details: departmentRemarks
          ? `Remarks: ${departmentRemarks}`
          : "Department started working on the feedback",
      });

      setShowModal(false);
      setSelectedComplaint(null);
      setDepartmentRemarks("");
      fetchComplaints();
    } catch (err) {
      console.error("Error updating feedback:", err);
      alert("Failed to update feedback");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolutionImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setImageError("File size must be less than 5MB");
      e.target.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      setImageError("Please upload an image file (JPG, PNG, GIF, etc.)");
      e.target.value = "";
      return;
    }

    setImageError("");
    setResolutionImage(file);
  };

  const handleResolve = async () => {
    if (!resolutionDetails) {
      alert("Please provide resolution details");
      return;
    }

    if (!resolutionImage) {
      alert("Please upload an image as proof of resolution");
      return;
    }

    setActionLoading(true);
    try {
      // Upload resolution image
      let resolutionImageUrl = null;
      const fileExt = resolutionImage.name.split(".").pop();
      const fileName = `resolution-${
        selectedComplaint.reference_number
      }-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(fileName, resolutionImage);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(
          uploadError.message ||
            "Failed to upload resolution image. Check storage permissions and try again."
        );
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("attachments").getPublicUrl(fileName);
      resolutionImageUrl = publicUrl;

      const { error: updateError } = await supabase
        .from("complaints")
        .update({
          status: "resolved",
          resolution_details: resolutionDetails,
          department_remarks: departmentRemarks,
          resolution_image_url: resolutionImageUrl,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq("id", selectedComplaint.id);

      if (updateError) throw updateError;

      await supabase.from("audit_trail").insert({
        complaint_id: selectedComplaint.id,
        action: "Feedback Resolved",
        performed_by: user.id,
        details: `Resolution: ${resolutionDetails}`,
      });

      setShowModal(false);
      setSelectedComplaint(null);
      setResolutionDetails("");
      setDepartmentRemarks("");
      setResolutionImage(null);
      fetchComplaints();
    } catch (err) {
      console.error("Error resolving feedback:", err);
      alert("Failed to resolve feedback");
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
    pending: complaints.filter((c) => c.status === "verified").length,
    inProgress: complaints.filter((c) => c.status === "in_progress").length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
  };

  return (
    <div className="min-h-[calc(100vh-200px)] py-8 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 bg-maroon-800 rounded-xl flex items-center justify-center">
              <Building2 size={24} className="text-gold-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Department Dashboard
              </h1>
              <p className="text-gray-600">
                {departmentLabels[userDepartment] || userDepartment}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500">Total Assigned</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gold-100 shadow-sm">
            <p className="text-sm text-gold-600">Pending</p>
            <p className="text-2xl font-bold text-gold-700">{stats.pending}</p>
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
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center space-x-2">
                <Filter size={18} className="text-gray-400" />
                <span className="text-sm text-gray-500 hidden sm:inline">
                  Filters:
                </span>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none bg-white text-sm flex-1 sm:flex-none"
              >
                <option value="all">All Status</option>
                <option value="verified">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none bg-white text-sm flex-1 sm:flex-none"
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
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none bg-white text-sm flex-1 sm:flex-none"
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
              <span className="text-sm text-gray-500 w-full sm:w-auto sm:ml-auto mt-2 sm:mt-0">
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
              <p className="text-gray-500">
                No complaints assigned to your department
              </p>
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
                    {(complaint.complaint_attachments?.length > 0 || complaint.attachment_url) && (
                      <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
                        <Image size={16} />
                        <span>Has attachment</span>
                      </div>
                    )}

                    {/* Admin Remarks (if any) */}
                    {complaint.admin_remarks && (
                      <div className="flex items-center space-x-2 text-sm text-gold-700 bg-gold-50 px-3 py-2 rounded-lg mb-4">
                        <MessageSquare size={16} />
                        <span className="truncate">
                          Admin: {complaint.admin_remarks}
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
                    setResolutionDetails("");
                    setDepartmentRemarks("");
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

                {/* Admin Remarks */}
                {selectedComplaint.admin_remarks && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Admin Remarks</p>
                    <div className="bg-gold-50 border border-gold-200 rounded-xl p-4">
                      <p className="text-gold-900">
                        {selectedComplaint.admin_remarks}
                      </p>
                    </div>
                  </div>
                )}

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
                            <Eye size={16} />
                            <span>View Full Image</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Section - For verified complaints (start progress) */}
                {selectedComplaint.status === "verified" && (
                  <div className="border-t border-gray-100 pt-6">
                    <h3 className="font-semibold text-gray-900 mb-4">
                      Take Action
                    </h3>

                    {/* Remarks */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Remarks{" "}
                        <span className="text-gray-400">(optional)</span>
                      </label>
                      <textarea
                        value={departmentRemarks}
                        onChange={(e) => setDepartmentRemarks(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none resize-none"
                        placeholder="Add any initial remarks..."
                      />
                    </div>

                    <button
                      onClick={handleStartProgress}
                      disabled={actionLoading}
                      className="w-full bg-orange-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <>
                          <PlayCircle size={20} />
                          <span>Start Working on This</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Action Section - For in_progress complaints (resolve) */}
                {selectedComplaint.status === "in_progress" && (
                  <div className="border-t border-gray-100 pt-6">
                    <h3 className="font-semibold text-gray-900 mb-4">
                      Resolve Feedback
                    </h3>

                    {/* Resolution Details */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resolution Details{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={resolutionDetails}
                        onChange={(e) => setResolutionDetails(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none resize-none"
                        placeholder="Describe how the feedback was resolved..."
                      />
                    </div>

                    {/* Resolution Image Upload - Required */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resolution Proof Image{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      {imageError && (
                        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-red-700 text-sm">{imageError}</p>
                        </div>
                      )}
                      <div className="relative">
                        <input
                          type="file"
                          onChange={handleResolutionImageChange}
                          accept="image/*"
                          className="hidden"
                          id="resolutionImage"
                        />
                        <label
                          htmlFor="resolutionImage"
                          className={`flex items-center justify-center space-x-2 w-full py-4 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                            resolutionImage
                              ? "border-green-400 bg-green-50"
                              : "border-gray-300 hover:border-green-400 hover:bg-gray-50"
                          }`}
                        >
                          <Upload
                            size={20}
                            className={
                              resolutionImage
                                ? "text-green-500"
                                : "text-gray-400"
                            }
                          />
                          <span
                            className={
                              resolutionImage
                                ? "text-green-700"
                                : "text-gray-600"
                            }
                          >
                            {resolutionImage
                              ? resolutionImage.name
                              : "Upload proof of resolution (required)"}
                          </span>
                        </label>
                      </div>
                      {resolutionImage && (
                        <div className="mt-3">
                          <img
                            src={URL.createObjectURL(resolutionImage)}
                            alt="Resolution Preview"
                            className="max-h-40 rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => setResolutionImage(null)}
                            className="mt-2 text-sm text-red-600 hover:text-red-800"
                          >
                            Remove image
                          </button>
                        </div>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        Upload an image showing the resolved issue (JPG, PNG,
                        GIF - max 5MB)
                      </p>
                    </div>

                    {/* Additional Remarks */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Remarks{" "}
                        <span className="text-gray-400">(optional)</span>
                      </label>
                      <textarea
                        value={departmentRemarks}
                        onChange={(e) => setDepartmentRemarks(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none resize-none"
                        placeholder="Any additional notes..."
                      />
                    </div>

                    <button
                      onClick={handleResolve}
                      disabled={
                        actionLoading || !resolutionDetails || !resolutionImage
                      }
                      className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <>
                          <CheckCircle size={20} />
                          <span>Mark as Resolved</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Show resolution for resolved complaints */}
                {selectedComplaint.status === "resolved" && (
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
                        <div className="bg-gray-50 rounded-xl p-4">
                          <img
                            src={selectedComplaint.resolution_image_url}
                            alt="Resolution Proof"
                            className="max-h-64 rounded-lg border border-gray-200 mb-2"
                          />
                          <a
                            href={selectedComplaint.resolution_image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-2 text-green-700 hover:text-green-600 text-sm"
                          >
                            <Eye size={16} />
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

export default DepartmentDashboard;
