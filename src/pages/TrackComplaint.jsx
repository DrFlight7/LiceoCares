import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  User,
  Tag,
  Calendar,
  Building2,
  MessageSquare,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Lock,
  Timer,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";

const TrackComplaint = () => {
  const { referenceNumber: urlRefNumber } = useParams();
  const [searchParams] = useSearchParams();
  const queryRefNumber = searchParams.get("ref");
  
  const [referenceNumber, setReferenceNumber] = useState("");
  const [complaint, setComplaint] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // Auto-load ticket from URL parameter or query string
  useEffect(() => {
    const refToLoad = urlRefNumber || queryRefNumber;
    if (refToLoad && !complaint) {
      setReferenceNumber(refToLoad);
      handleSearchWithRef(refToLoad);
    }
  }, [urlRefNumber, queryRefNumber]);

  // Helper to get attachments with fallback for legacy single attachment_url
  const getAttachments = (complaint) => {
    if (complaint?.complaint_attachments?.length > 0) {
      return complaint.complaint_attachments;
    }
    if (complaint?.attachment_url) {
      return [{ id: complaint.id, attachment_url: complaint.attachment_url }];
    }
    return [];
  };

  const statusConfig = {
    submitted: {
      label: "Submitted",
      color: "bg-blue-100 text-blue-800 border-blue-200",
      icon: FileText,
      description:
        "Your feedback has been received and is awaiting verification.",
    },
    verified: {
      label: "Verified",
      color: "bg-gold-100 text-gold-800 border-gold-200",
      icon: CheckCircle,
      description:
        "Your feedback has been verified and assigned to a department.",
    },
    rejected: {
      label: "Rejected",
      color: "bg-red-100 text-red-800 border-red-200",
      icon: XCircle,
      description: "Your feedback was not approved. See remarks for details.",
    },
    in_progress: {
      label: "In Progress",
      color: "bg-orange-100 text-orange-800 border-orange-200",
      icon: Clock,
      description:
        "The department is actively working on resolving your feedback.",
    },
    resolved: {
      label: "Resolved",
      color: "bg-green-100 text-green-800 border-green-200",
      icon: CheckCircle,
      description:
        "Your feedback has been resolved. Please verify if the issue was properly addressed.",
    },
    closed: {
      label: "Closed",
      color: "bg-gray-100 text-gray-800 border-gray-200",
      icon: Lock,
      description:
        "This feedback has been closed. Thank you for your feedback.",
    },
    disputed: {
      label: "Disputed",
      color: "bg-amber-100 text-amber-800 border-amber-200",
      icon: AlertCircle,
      description:
        "You have disputed the resolution. The admin will review your concern.",
    },
  };

  // Search with a provided reference number (for URL parameter loading)
  const handleSearchWithRef = async (ref) => {
    setError("");
    setComplaint(null);
    setAuditTrail([]);
    setLoading(true);
    setSearched(true);

    try {
      const { data, error: fetchError } = await supabase
        .from("complaints")
        .select("*, complaint_attachments(*)")
        .eq("reference_number", ref.toUpperCase())
        .single();

      if (fetchError) {
        if (fetchError.code === "PGRST116") {
          setError("No feedback found with this reference number.");
        } else {
          throw fetchError;
        }
        setLoading(false);
        return;
      }

      setComplaint(data);

      const { data: trailData } = await supabase
        .from("audit_trail")
        .select("*")
        .eq("complaint_id", data.id)
        .order("created_at", { ascending: true });

      if (trailData) {
        setAuditTrail(trailData);
      }

      // Fetch comments (only non-internal ones for complainants)
      const { data: commentsData } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("complaint_id", data.id)
        .eq("is_internal", false)
        .order("created_at", { ascending: true });

      if (commentsData) {
        setComments(commentsData);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setError("");
    setComplaint(null);
    setAuditTrail([]);
    setLoading(true);
    setSearched(true);

    try {
      const { data, error: fetchError } = await supabase
        .from("complaints")
        .select("*, complaint_attachments(*)")
        .eq("reference_number", referenceNumber.toUpperCase())
        .single();

      if (fetchError) {
        if (fetchError.code === "PGRST116") {
          setError("No feedback found with this reference number.");
        } else {
          throw fetchError;
        }
        setLoading(false);
        return;
      }

      setComplaint(data);

      const { data: trailData } = await supabase
        .from("audit_trail")
        .select("*")
        .eq("complaint_id", data.id)
        .order("created_at", { ascending: true });

      if (trailData) {
        setAuditTrail(trailData);
      }

      // Fetch comments (only non-internal ones for complainants)
      const { data: commentsData } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("complaint_id", data.id)
        .eq("is_internal", false)
        .order("created_at", { ascending: true });

      if (commentsData) {
        setComments(commentsData);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRemainingDays = (resolvedAt) => {
    if (!resolvedAt) return 0;
    const resolvedDate = new Date(resolvedAt);
    const expiryDate = new Date(resolvedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const remainingMs = expiryDate - now;
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    return Math.max(0, remainingDays);
  };

  const isWithinVerificationWindow = (resolvedAt) => {
    return getRemainingDays(resolvedAt) > 0;
  };

  const fetchComments = async (complaintId) => {
    const { data: commentsData } = await supabase
      .from("ticket_comments")
      .select("*")
      .eq("complaint_id", complaintId)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });

    if (commentsData) {
      setComments(commentsData);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !complaint) return;

    setCommentLoading(true);
    try {
      const { error: insertError } = await supabase
        .from("ticket_comments")
        .insert({
          complaint_id: complaint.id,
          content: newComment.trim(),
          author_name: complaint.name || "Anonymous",
          author_type: "complainant",
          is_internal: false,
        });

      if (insertError) throw insertError;

      setNewComment("");
      await fetchComments(complaint.id);
    } catch (err) {
      setError(err.message || "Failed to post comment");
    } finally {
      setCommentLoading(false);
    }
  };

  const formatCommentDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleConfirmResolution = async () => {
    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("complaints")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          user_verified: true,
        })
        .eq("id", complaint.id);

      if (updateError) throw updateError;

      await supabase.from("audit_trail").insert({
        complaint_id: complaint.id,
        action: "Resolution Confirmed by User",
        details: "The complainant confirmed that the issue was resolved satisfactorily.",
      });

      // Refresh complaint data
      const { data: updatedComplaint } = await supabase
        .from("complaints")
        .select("*")
        .eq("id", complaint.id)
        .single();

      if (updatedComplaint) {
        setComplaint(updatedComplaint);
      }

      const { data: trailData } = await supabase
        .from("audit_trail")
        .select("*")
        .eq("complaint_id", complaint.id)
        .order("created_at", { ascending: true });

      if (trailData) {
        setAuditTrail(trailData);
      }
    } catch (err) {
      setError(err.message || "Failed to confirm resolution");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisputeResolution = async () => {
    if (!disputeReason.trim()) {
      setError("Please provide a reason for disputing the resolution");
      return;
    }

    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("complaints")
        .update({
          status: "disputed",
          dispute_reason: disputeReason,
          disputed_at: new Date().toISOString(),
        })
        .eq("id", complaint.id);

      if (updateError) throw updateError;

      await supabase.from("audit_trail").insert({
        complaint_id: complaint.id,
        action: "Resolution Disputed by User",
        details: `Reason: ${disputeReason}`,
      });

      // Refresh complaint data
      const { data: updatedComplaint } = await supabase
        .from("complaints")
        .select("*")
        .eq("id", complaint.id)
        .single();

      if (updatedComplaint) {
        setComplaint(updatedComplaint);
      }

      const { data: trailData } = await supabase
        .from("audit_trail")
        .select("*")
        .eq("complaint_id", complaint.id)
        .order("created_at", { ascending: true });

      if (trailData) {
        setAuditTrail(trailData);
      }

      setDisputeReason("");
      setShowDisputeForm(false);
    } catch (err) {
      setError(err.message || "Failed to dispute resolution");
    } finally {
      setActionLoading(false);
    }
  };

  const StatusBadge = ({ status }) => {
    const config = statusConfig[status] || statusConfig.submitted;
    const Icon = config.icon;
    return (
      <span
        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${config.color}`}
      >
        <Icon size={16} />
        <span>{config.label}</span>
      </span>
    );
  };

  return (
    <div className="min-h-[calc(100vh-200px)] py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-maroon-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search size={32} className="text-gold-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Track Your Feedback
          </h1>
          <p className="text-gray-600 mt-2">
            Enter your reference number to check the status
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 mb-8">
          <form
            onSubmit={handleSearch}
            className="flex flex-col sm:flex-row gap-4"
          >
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Tag size={20} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 transition-all duration-200 outline-none font-mono uppercase"
                placeholder="Enter reference number (e.g., LDCU-XXXXX-XXXX)"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-maroon-800 text-white px-8 py-3 rounded-xl font-semibold hover:bg-maroon-700 focus:ring-4 focus:ring-maroon-200 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Search size={20} />
                  <span>Track</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3">
            <AlertCircle
              size={20}
              className="text-red-500 flex-shrink-0 mt-0.5"
            />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Complaint Details */}
        {complaint && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1 space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Reference Number</p>
                  <p className="text-xl font-bold text-maroon-800 font-mono">
                    {complaint.reference_number}
                  </p>
                </div>
                <StatusBadge status={complaint.status} />
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  statusConfig[complaint.status]?.color || "bg-gray-100"
                }`}
              >
                <p className="text-sm">
                  {statusConfig[complaint.status]?.description}
                </p>
              </div>
            </div>

            {/* Complaint Info */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Feedback Details
              </h3>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="flex items-start space-x-3">
                  <User size={20} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Submitted By</p>
                    <p className="font-medium text-gray-900">
                      {complaint.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Tag size={20} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <p className="font-medium text-gray-900 capitalize">
                      {complaint.category}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Calendar size={20} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Date Submitted</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(complaint.created_at)}
                    </p>
                  </div>
                </div>
                {complaint.assigned_department && (
                  <div className="flex items-start space-x-3">
                    <Building2 size={20} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">
                        Assigned Department
                      </p>
                      <p className="font-medium text-gray-900 capitalize">
                        {complaint.assigned_department}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-start space-x-3">
                  <MessageSquare size={20} className="text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-1">Description</p>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {complaint.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Feedback Evidence Images */}
              {getAttachments(complaint).length > 0 && (
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <div className="flex items-start space-x-3">
                    <FileText size={20} className="text-gray-400 mt-0.5" />
                    <div className="flex-1 w-full">
                      <p className="text-sm text-gray-500 mb-3">Feedback Evidence</p>
                      <div className="space-y-3">
                        {getAttachments(complaint).map((attachment) => (
                          <div key={attachment.id || attachment.attachment_url} className="bg-gray-50 rounded-lg p-3">
                            <img
                              src={attachment.attachment_url}
                              alt="Feedback Evidence"
                              className="max-h-64 rounded-lg border border-gray-200 w-full object-contain mb-2"
                              onError={(e) => {
                                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"%3E%3Cpath stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /%3E%3C/svg%3E';
                              }}
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
                  </div>
                </div>
              )}

              {complaint.resolution_details && (
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle size={20} className="text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">Resolution</p>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {complaint.resolution_details}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {complaint.admin_remarks && (
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle size={20} className="text-orange-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">
                        Admin Remarks
                      </p>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {complaint.admin_remarks}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

{/* Verification Actions - Show when resolved and within 7 days */}
            {complaint.status === "resolved" && isWithinVerificationWindow(complaint.resolved_at) && (
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-green-200">
                <div className="flex items-center space-x-2 mb-4">
                  <Timer size={20} className="text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Verify Resolution
                  </h3>
                  <span className="ml-auto text-sm text-orange-600 font-medium bg-orange-50 px-3 py-1 rounded-full">
                    {getRemainingDays(complaint.resolved_at)} day{getRemainingDays(complaint.resolved_at) !== 1 ? 's' : ''} remaining
                  </span>
                </div>

                <p className="text-gray-600 mb-4">
                  Please confirm if your issue has been resolved satisfactorily, or dispute if you believe the problem was not properly addressed. 
                  If no action is taken within 7 days, the ticket will be automatically closed.
                </p>

                {!showDisputeForm ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleConfirmResolution}
                      disabled={actionLoading}
                      className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <>
                          <ThumbsUp size={20} />
                          <span>Confirm Resolution</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowDisputeForm(true)}
                      disabled={actionLoading}
                      className="flex-1 bg-amber-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-amber-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      <ThumbsDown size={20} />
                      <span>Dispute Resolution</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Why are you disputing this resolution? <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none"
                        placeholder="Please explain why you believe the issue was not properly resolved..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDisputeResolution}
                        disabled={actionLoading || !disputeReason.trim()}
                        className="flex-1 bg-amber-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-amber-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {actionLoading ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : (
                          <>
                            <ThumbsDown size={20} />
                            <span>Submit Dispute</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowDisputeForm(false);
                          setDisputeReason("");
                        }}
                        disabled={actionLoading}
                        className="px-6 py-3 border border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Show dispute reason if disputed */}
            {complaint.status === "disputed" && complaint.dispute_reason && (
              <div className="bg-amber-50 rounded-2xl shadow-xl p-6 border border-amber-200">
                <div className="flex items-start space-x-3">
                  <AlertCircle size={20} className="text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-700 mb-1 font-medium">Your Dispute Reason</p>
                    <p className="text-amber-900 whitespace-pre-wrap">{complaint.dispute_reason}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Audit Trail */}
            {auditTrail.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Activity Timeline
                </h3>
                <div className="space-y-4">
                  {auditTrail.map((entry, index) => (
                    <div key={entry.id} className="flex space-x-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            index === auditTrail.length - 1
                              ? "bg-maroon-800"
                              : "bg-gray-300"
                          }`}
                        ></div>
                        {index < auditTrail.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 mt-1"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="font-medium text-gray-900">
                          {entry.action}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(entry.created_at)}
                        </p>
                        {entry.details && (
                          <p className="text-sm text-gray-600 mt-1">
                            {entry.details}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>

            {/* Discussion Section - Right side on desktop, bottom on mobile */}
            <div className="lg:w-96 lg:flex-shrink-0">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 sticky top-4">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                    <MessageSquare size={20} className="text-maroon-800" />
                    <span>Discussion</span>
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Communicate about this ticket
                  </p>
                </div>

                {/* Comments List */}
                <div className="h-80 overflow-y-auto p-4 space-y-4">
                  {comments.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-500 text-sm">No comments yet</p>
                      <p className="text-gray-400 text-xs">Start the conversation</p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          comment.author_type === 'admin' 
                            ? 'bg-maroon-100 text-maroon-800' 
                            : comment.author_type === 'department'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          <User size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900 text-sm truncate">
                              {comment.author_name}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              comment.author_type === 'admin' 
                                ? 'bg-maroon-100 text-maroon-700' 
                                : comment.author_type === 'department'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {comment.author_type === 'complainant' ? 'You' : comment.author_type}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatCommentDate(comment.created_at)}
                            </span>
                          </div>
                          <p className="text-gray-700 text-sm mt-1 break-words">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment Input */}
                <div className="p-4 border-t border-gray-100">
                  <div className="flex space-x-2">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      rows={2}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 outline-none resize-none text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handlePostComment();
                        }
                      }}
                    />
                    <button
                      onClick={handlePostComment}
                      disabled={commentLoading || !newComment.trim()}
                      className="px-4 py-2 bg-maroon-800 text-white rounded-xl hover:bg-maroon-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {commentLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Press Enter to send</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Results */}
        {searched && !loading && !complaint && !error && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Results Found
            </h3>
            <p className="text-gray-600">
              Please check your reference number and try again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackComplaint;
