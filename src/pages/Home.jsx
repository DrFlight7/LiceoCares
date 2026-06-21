import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { sendTicketConfirmationEmail } from "../lib/resend";
import { useAuth } from "../contexts/AuthContext";
import {
  FileText,
  Search,
  Shield,
  CheckCircle,
  Clock,
  Users,
  Send,
  ImagePlus,
  X,
  Copy,
  User,
  Mail,
  Tag,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

const Home = () => {
  const { user, isStudent, studentProfile } = useAuth();
  const [complaint, setComplaint] = useState("");
  const [category, setCategory] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPersonalDetails, setShowPersonalDetails] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showCategoryReminder, setShowCategoryReminder] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ title: "", details: [] });
  const [fieldErrors, setFieldErrors] = useState({
    complaint: false,
    category: false,
  });
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [allowGuestLogin, setAllowGuestLogin] = useState(false);

  const placeholderTexts = [
    "Share your concern with us - we're here to help...",
    "Report issues about facilities, academics, or services...",
    "Your feedback helps improve our university community...",
    "Experiencing problems on campus? Let us know here...",
    "We value your voice - every feedback is reviewed carefully...",
    "Help us serve you better by sharing your concerns...",
    "From classroom issues to campus safety - we listen...",
    "Anonymous submissions welcome - your privacy matters...",
    "Together we can make Liceo a better place for everyone...",
  ];
  const [personalDetails, setPersonalDetails] = useState({
    name: "",
    email: "",
    studentId: "",
    isAnonymous: false,
  });

  useEffect(() => {
    const currentText = placeholderTexts[placeholderIndex];
    let charIndex = 0;
    let typingTimeout;
    let eraseTimeout;

    if (isTyping) {
      const typeChar = () => {
        if (charIndex <= currentText.length) {
          setDisplayedPlaceholder(currentText.slice(0, charIndex));
          charIndex++;
          typingTimeout = setTimeout(typeChar, 50);
        } else {
          setTimeout(() => setIsTyping(false), 2000);
        }
      };
      typeChar();
    } else {
      charIndex = currentText.length;
      const eraseChar = () => {
        if (charIndex >= 0) {
          setDisplayedPlaceholder(currentText.slice(0, charIndex));
          charIndex--;
          eraseTimeout = setTimeout(eraseChar, 30);
        } else {
          setPlaceholderIndex((prev) => (prev + 1) % placeholderTexts.length);
          setIsTyping(true);
        }
      };
      eraseChar();
    }

    return () => {
      clearTimeout(typingTimeout);
      clearTimeout(eraseTimeout);
    };
  }, [placeholderIndex, isTyping]);

  useEffect(() => {
    const fetchCategoriesAndSettings = async () => {
      try {
        const [categoriesResponse, settingsResponse] = await Promise.all([
          supabase
            .from("departments")
            .select("code, name")
            .eq("is_active", true)
            .order("name", { ascending: true }),
          supabase
            .from("system_settings")
            .select("allow_guest_login")
            .single()
        ]);

        if (categoriesResponse.error) throw categoriesResponse.error;

        const formattedCategories = (categoriesResponse.data || []).map((dept) => ({
          value: dept.code,
          label: dept.name,
        }));
        setCategories(formattedCategories);

        if (!settingsResponse.error && settingsResponse.data) {
          setAllowGuestLogin(settingsResponse.data.allow_guest_login ?? false);
        } else {
          setAllowGuestLogin(false);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setCategories([]);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategoriesAndSettings();
  }, []);

  const generateReferenceNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LDCU-${timestamp}-${random}`;
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const validImages = [];

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Each file must be less than 5MB");
        continue;
      }
      if (!file.type.startsWith("image/")) {
        setError("Please upload only image files");
        continue;
      }
      validImages.push(file);
    }

    setImages((prev) => [...prev, ...validImages]);
    e.target.value = "";
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePersonalDetailsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPersonalDetails((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referenceNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setComplaint("");
    setCategory("");
    setImages([]);
    setReferenceNumber("");
    setShowPersonalDetails(false);
    setShowPopup(false);
    setPersonalDetails({
      name: "",
      email: "",
      studentId: "",
      isAnonymous: false,
    });
  };

  const closePopup = () => {
    setShowPopup(false);
    resetForm();
  };

  const getClientIP = async () => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip;
    } catch {
      return null;
    }
  };

  const checkIPRateLimit = async (ipAddress) => {
    if (!ipAddress) return { allowed: true };

    try {
      // First check if IP is blocked
      const { data: blockedData } = await supabase
        .from("blocked_ips")
        .select("id")
        .eq("ip_address", ipAddress)
        .or("expires_at.is.null,expires_at.gt.now()")
        .limit(1);

      if (blockedData && blockedData.length > 0) {
        return {
          allowed: false,
          reason:
            "Your IP address has been blocked from submitting complaints.",
        };
      }

      // Fetch rate limits configuration
      const { data: limitsData } = await supabase
        .from("rate_limits")
        .select("*")
        .eq("id", 1)
        .single();

      const limits = limitsData || {
        daily_limit: 5,
        weekly_limit: 15,
        monthly_limit: 30,
        yearly_limit: 100,
        cooldown_minutes: 30,
        enabled: true,
      };

      // If rate limiting is disabled, allow
      if (!limits.enabled) {
        return { allowed: true };
      }

      // Get submission counts for each period
      const now = new Date();
      const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const yearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000);

      // Get all submissions for this IP in the past year
      const { data: submissions, error } = await supabase
        .from("complaint_submissions")
        .select("created_at")
        .eq("ip_address", ipAddress)
        .gte("created_at", yearAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Rate limit check error:", error);
        return { allowed: true };
      }

      const submissionDates = (submissions || []).map(
        (s) => new Date(s.created_at)
      );

      // Check cooldown period
      if (submissionDates.length > 0 && limits.cooldown_minutes > 0) {
        const lastSubmission = submissionDates[0];
        const cooldownEnd = new Date(
          lastSubmission.getTime() + limits.cooldown_minutes * 60 * 1000
        );
        if (now < cooldownEnd) {
          const minutesLeft = Math.ceil((cooldownEnd - now) / (60 * 1000));
          return {
            allowed: false,
            reason: `Please wait ${minutesLeft} minute${
              minutesLeft > 1 ? "s" : ""
            } before submitting another feedback.`,
          };
        }
      }

      // Count submissions per period
      const dailyCount = submissionDates.filter((d) => d > dayAgo).length;
      const weeklyCount = submissionDates.filter((d) => d > weekAgo).length;
      const monthlyCount = submissionDates.filter((d) => d > monthAgo).length;
      const yearlyCount = submissionDates.length;

      // Check limits
      if (dailyCount >= limits.daily_limit) {
        return {
          allowed: false,
          reason: `You have reached the daily limit of ${limits.daily_limit} submissions. Please try again tomorrow.`,
        };
      }
      if (weeklyCount >= limits.weekly_limit) {
        return {
          allowed: false,
          reason: `You have reached the weekly limit of ${limits.weekly_limit} submissions. Please try again next week.`,
        };
      }
      if (monthlyCount >= limits.monthly_limit) {
        return {
          allowed: false,
          reason: `You have reached the monthly limit of ${limits.monthly_limit} submissions. Please try again next month.`,
        };
      }
      if (yearlyCount >= limits.yearly_limit) {
        return {
          allowed: false,
          reason: `You have reached the yearly limit of ${limits.yearly_limit} submissions.`,
        };
      }

      return { allowed: true };
    } catch (err) {
      console.error("Rate limit check error:", err);
      return { allowed: true };
    }
  };

  const recordSubmission = async (ipAddress, complaintId) => {
    if (!ipAddress) return;

    try {
      await supabase.from("complaint_submissions").insert({
        ip_address: ipAddress,
        complaint_id: complaintId,
        user_agent: navigator.userAgent,
      });
    } catch (err) {
      console.error("Error recording submission:", err);
    }
  };

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    setError("");

    const errors = {
      complaint: !complaint.trim(),
      category: !category,
    };
    setFieldErrors(errors);

    if (errors.complaint || errors.category) {
      const missingFields = [];
      if (errors.complaint) missingFields.push("Your feedback message");
      if (errors.category) missingFields.push("Category selection");
      setAlertMessage({
        title: "Please complete the following:",
        details: missingFields,
      });
      setShowAlert(true);
      setTimeout(
        () => setFieldErrors({ complaint: false, category: false }),
        600
      );
      return;
    }

    // Block submission if guest login is disabled and user is not logged in
    if (!allowGuestLogin && !user) {
      setError("You must be logged in to submit feedback. Guest submissions are currently disabled.");
      return;
    }

    setLoading(true);


    try {
      const ipAddress = await getClientIP();
      const { allowed, reason } = await checkIPRateLimit(ipAddress);

      if (!allowed) {
        setError(
          reason ||
            "You have reached the submission limit. Please try again later."
        );
        setLoading(false);
        return;
      }

      const refNumber = generateReferenceNumber();
      const uploadedUrls = [];

      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${refNumber}-${i + 1}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(fileName, file);

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("attachments").getPublicUrl(fileName);
          uploadedUrls.push(publicUrl);
        }
      }

      const { data: complaintData, error: insertError } = await supabase
        .from("complaints")
        .insert({
          reference_number: refNumber,
          name: personalDetails.isAnonymous
            ? "Anonymous"
            : (user ? (studentProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "User") : personalDetails.name) || "Anonymous",
          email: user?.email || personalDetails.email || null,
          student_id: personalDetails.studentId || null,
          category: category,
          description: complaint,
          is_anonymous: personalDetails.isAnonymous || !personalDetails.name,
          attachment_url: uploadedUrls[0] || null,
          status: "submitted",
          user_id: user?.id || null, // Track which logged-in user created this
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      await recordSubmission(ipAddress, complaintData?.id);

      // Send confirmation email immediately if user is logged in
      const userEmail = user?.email || studentProfile?.email;
      console.log("Attempting to send email to:", userEmail, "User:", user?.id);
      
      if (userEmail) {
        try {
          const emailResult = await sendTicketConfirmationEmail({
            to: userEmail,
            referenceNumber: refNumber,
            category: category,
            description: complaint,
          });
          console.log("Email send result:", emailResult);
        } catch (emailErr) {
          console.error("Error sending confirmation email:", emailErr);
        }
      } else {
        console.log("No email available for logged-in user");
      }

      setReferenceNumber(refNumber);
      setShowPopup(true);
    } catch (err) {
      console.error("Submit error:", err);
      setError(err.message || "Failed to submit feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: FileText,
      title: "Submit Complaint(s)",
      description:
        "Easily submit your concerns through our streamlined feedback form. Anonymous submissions are welcome.",
      color: "bg-maroon-800",
    },
    {
      icon: Shield,
      title: "Verified Process",
      description:
        "All complaints are verified by the VP Admin to ensure legitimacy before being forwarded to departments.",
      color: "bg-gold-600",
    },
    {
      icon: Clock,
      title: "Track Progress",
      description:
        "Monitor your feedback status in real-time using your unique reference number.",
      color: "bg-maroon-800",
    },
    {
      icon: CheckCircle,
      title: "Resolution Focused",
      description:
        "Dedicated department officers work to resolve your concerns efficiently and effectively.",
      color: "bg-gold-600",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Submit",
      description: "Fill out the feedback form with your concerns",
    },
    {
      number: "02",
      title: "Verify",
      description: "Admin reviews and verifies your feedback",
    },
    {
      number: "03",
      title: "Assign",
      description: "Feedback is forwarded to the relevant department",
    },
    {
      number: "04",
      title: "Resolve",
      description: "Department works on resolution and updates status",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-maroon-800 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-gold-500 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-gold-500 rounded-full translate-x-1/2 translate-y-1/2"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center space-x-2 bg-maroon-700 px-4 py-2 rounded-full mb-6">
              <Users size={18} className="text-gold-400" />
              <span className="text-sm text-gold-300">
                Liceo Community Portal
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Your Voice <span className="text-gold-400">Matters</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-8">
              Liceo Cares is your dedicated platform for submitting and tracking
              feedback. We ensure every concern is heard, verified, and
              resolved efficiently.
            </p>

            {/* Chat-style complaint form */}
            {
              <form
                onSubmit={handleSubmitComplaint}
                className="max-w-2xl mx-auto"
              >
                {/* Error message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-400 rounded-xl text-red-100 text-sm">
                    {error}
                  </div>
                )}

                {/* Complaint textarea */}
                <div
                  className={`backdrop-blur-sm border-2 rounded-2xl p-4 mb-4 transition-all duration-300 ${
                    fieldErrors.feedback
                      ? "bg-red-500/20 border-red-400 animate-shake"
                      : isFocused
                      ? "bg-white/20 border-gold-400 shadow-lg shadow-gold-500/20"
                      : "bg-white/10 border-white/30"
                  }`}
                >
                  <textarea
                    value={complaint}
                    onChange={(e) => {
                      setComplaint(e.target.value);
                      setShowAlert(false);
                      setFieldErrors((prev) => ({ ...prev, complaint: false }));
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={displayedPlaceholder || "|"}
                    rows={3}
                    className="w-full bg-transparent text-white placeholder-gray-300 focus:outline-none resize-none transition-all"
                  />

                  {/* Image previews */}
                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
                      {images.map((img, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(img)}
                            alt={`Upload ${index + 1}`}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                          >
                            <X size={12} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action buttons row */}
                  <div className="flex flex-row items-center gap-2 sm:gap-3 mt-3 pt-3 border-t border-white/20 overflow-hidden">
                    <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                      {/* Category selector - moved to left of images */}
                      <select
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value);
                          setShowCategoryReminder(false);
                          setShowAlert(false);
                          setFieldErrors((prev) => ({
                            ...prev,
                            category: false,
                          }));
                        }}
                        disabled={categoriesLoading || categories.length === 0}
                        style={{ width: '140px', maxWidth: '140px' }}
                        className={`flex-shrink-0 bg-white/10 border rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-gold-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          fieldErrors.category
                            ? "border-red-400 bg-red-500/20 animate-shake"
                            : showCategoryReminder
                            ? "border-gold-400 animate-pulse"
                            : "border-white/30"
                        }`}
                      >
                        <option value="" className="text-gray-900">
                          {categoriesLoading
                            ? "Loading categories..."
                            : categories.length === 0
                            ? "No categories available"
                            : "Select Category"}
                        </option>
                        {categories.map((cat) => (
                          <option
                            key={cat.value}
                            value={cat.value}
                            className="text-gray-900"
                          >
                            {cat.label}
                          </option>
                        ))}
                      </select>

                      {/* Image upload button */}
                      <label className="cursor-pointer p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2">
                        <ImagePlus size={20} className="text-gold-400" />
                        <span className="text-xs text-gray-400">
                          {images.length > 0
                            ? `${images.length} image(s)`
                            : "Add images (optional)"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className={`p-3 rounded-xl transition-all duration-200 flex-shrink-0 ${
                        loading
                          ? "opacity-50 cursor-not-allowed"
                          : complaint.trim() && category
                          ? "bg-gold-400 text-maroon-900 hover:bg-gold-300 hover:scale-110 active:scale-95 shadow-lg shadow-gold-500/30"
                          : "bg-gold-500/70 text-maroon-900 hover:bg-gold-400 hover:scale-110 active:scale-95"
                      }`}
                    >
                      {loading ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <Send size={20} />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-400 mt-3">
                  Select a category and click send to submit (images are
                  optional)
                </p>
              </form>
            }

            {/* Track complaint link */}
            <div className="mt-6">
              <Link
                to="/track"
                className="inline-flex items-center space-x-2 text-gold-300 hover:text-gold-400 hover:scale-105 active:scale-95 transition-all"
              >
                <Search size={18} />
                <span>Already submitted? Track your feedback</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Soft Alert Toast for missing fields */}
      {showAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top fade-in duration-300 w-[90%] sm:w-auto">
          <div className="bg-white rounded-xl px-3 sm:px-5 py-3 sm:py-4 shadow-2xl border border-gray-200 max-w-sm">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Shield size={16} className="text-red-500 sm:hidden" />
                <Shield size={20} className="text-red-500 hidden sm:block" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 text-xs sm:text-sm mb-1">
                  {alertMessage.title}
                </h4>
                <ul className="space-y-0.5 sm:space-y-1">
                  {alertMessage.details.map((item, index) => (
                    <li
                      key={index}
                      className="text-[10px] sm:text-xs text-gray-600 flex items-center gap-1 sm:gap-1.5"
                    >
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-400 rounded-full flex-shrink-0"></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setShowAlert(false)}
                className="p-1 hover:bg-gray-100 hover:scale-110 active:scale-95 rounded-full transition-all"
              >
                <X size={14} className="text-gray-400 sm:hidden" />
                <X size={16} className="text-gray-400 hidden sm:block" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup Modal */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full relative shadow-2xl animate-in fade-in zoom-in duration-300">
            {/* Close button */}
            <button
              onClick={closePopup}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 hover:bg-gray-100 hover:scale-110 active:scale-95 rounded-full transition-all"
            >
              <X size={18} className="text-gray-500 sm:hidden" />
              <X size={20} className="text-gray-500 hidden sm:block" />
            </button>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Feedback Submitted!
              </h2>
              <p className="text-gray-600 mb-6">
                Your feedback has been received. Save your tracking number
                below.
              </p>

              <div className="bg-maroon-50 border border-maroon-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-maroon-600 mb-2">
                  Your Tracking Number
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-lg sm:text-2xl font-bold text-maroon-800 font-mono break-all">
                    {referenceNumber}
                  </span>
                  <button
                    onClick={copyToClipboard}
                    className="p-2 hover:bg-maroon-100 hover:scale-110 active:scale-95 rounded-lg transition-all flex-shrink-0"
                    title="Copy to clipboard"
                  >
                    <Copy
                      size={20}
                      className={copied ? "text-green-600" : "text-maroon-600"}
                    />
                  </button>
                </div>
                {copied && (
                  <p className="text-sm text-green-600 mt-2">
                    Copied to clipboard!
                  </p>
                )}
              </div>

              {/* Optional personal details section in popup */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden mb-6">
                <button
                  type="button"
                  onClick={() => setShowPersonalDetails(!showPersonalDetails)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-100 active:bg-gray-200 transition-all"
                >
                  <span className="text-sm text-gray-700 font-medium">
                    Add additional details (optional)
                  </span>
                  {showPersonalDetails ? (
                    <ChevronUp size={18} className="text-gray-500" />
                  ) : (
                    <ChevronDown size={18} className="text-gray-500" />
                  )}
                </button>

                {showPersonalDetails && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Anonymous toggle */}
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="isAnonymous"
                        checked={personalDetails.isAnonymous}
                        onChange={handlePersonalDetailsChange}
                        className="w-4 h-4 text-maroon-800 border-gray-300 rounded focus:ring-maroon-500"
                      />
                      <EyeOff size={16} className="text-gray-500" />
                      <span className="text-sm text-gray-700">
                        Submit Anonymously
                      </span>
                    </label>

                    {!personalDetails.isAnonymous && (
                      <div className="relative">
                        <User
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          name="name"
                          value={user ? (studentProfile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "") : personalDetails.name}
                          onChange={handlePersonalDetailsChange}
                          placeholder="Full Name"
                          disabled={!!user}
                          className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-maroon-500 focus:ring-1 focus:ring-maroon-500 ${
                            user ? "bg-gray-100 cursor-not-allowed" : "bg-white"
                          }`}
                        />
                      </div>
                    )}

                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="email"
                        name="email"
                        value={user ? user.email : personalDetails.email}
                        onChange={handlePersonalDetailsChange}
                        placeholder="Email (for updates)"
                        disabled={!!user}
                        className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-maroon-500 focus:ring-1 focus:ring-maroon-500 ${
                          user ? "bg-gray-100 cursor-not-allowed" : "bg-white"
                        }`}
                      />
                      {user && (
                        <span className="text-xs text-green-600 mt-1 block">
                          ✓ Logged in as {user.email}
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <Tag
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        name="studentId"
                        value={personalDetails.studentId}
                        onChange={handlePersonalDetailsChange}
                        placeholder="Student/Employee ID"
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-maroon-500 focus:ring-1 focus:ring-maroon-500"
                      />
                    </div>

                    {/* Send button for additional details */}
                    <button
                      type="button"
                      onClick={async () => {
                        setDetailsLoading(true);
                        try {
                          const { error: updateError } = await supabase
                            .from("complaints")
                            .update({
                              name: personalDetails.isAnonymous
                                ? "Anonymous"
                                : personalDetails.name || "Anonymous",
                              email: personalDetails.email || null,
                              student_id: personalDetails.studentId || null,
                              is_anonymous:
                                personalDetails.isAnonymous ||
                                !personalDetails.name,
                            })
                            .eq("reference_number", referenceNumber);
                          if (!updateError) {
                            // Send confirmation email if email was provided
                            if (personalDetails.email) {
                              await sendTicketConfirmationEmail({
                                to: personalDetails.email,
                                referenceNumber: referenceNumber,
                                category: category,
                                description: complaint,
                              });
                            }
                            setShowPersonalDetails(false);
                            setDetailsSuccess(true);
                            setTimeout(() => setDetailsSuccess(false), 3000);
                          }
                        } catch (err) {
                          console.error("Error updating details:", err);
                        } finally {
                          setDetailsLoading(false);
                        }
                      }}
                      disabled={detailsLoading}
                      className="w-full flex items-center justify-center gap-2 bg-maroon-800 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-maroon-700 active:bg-maroon-900 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {detailsLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <>
                          <Send size={16} />
                          <span>Save Details</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Success alert for details saved */}
              {detailsSuccess && (
                <div className="mb-4 p-2 sm:p-3 bg-green-100 border border-green-300 rounded-xl text-green-700 text-xs sm:text-sm flex items-center gap-2">
                  <CheckCircle size={16} className="flex-shrink-0" />
                  <span>Details saved successfully!</span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Link
                  to="/track"
                  className="inline-flex items-center justify-center space-x-2 bg-maroon-800 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold hover:bg-maroon-700 active:bg-maroon-900 active:scale-[0.98] transition-all duration-200 shadow-md"
                >
                  <Search size={18} />
                  <span>Track Your Feedback</span>
                </Link>
                <button
                  onClick={closePopup}
                  className="inline-flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold hover:bg-gray-200 active:bg-gray-300 active:scale-[0.98] transition-all duration-200"
                >
                  <span>Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why <span className="text-maroon-800">Liceo Cares</span>?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Your voice matters. We've designed a transparent and efficient
              platform to ensure your suggestions are heard and your concerns
              are addressed promptly.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-gray-50 rounded-2xl p-4 sm:p-6 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 border border-gray-100 hover:border-gold-300 text-center sm:text-left cursor-pointer"
              >
                <div
                  className={`${feature.color} w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-3 sm:mb-4 mx-auto sm:mx-0`}
                >
                  <feature.icon size={24} className="text-white sm:hidden" />
                  <feature.icon
                    size={28}
                    className="text-white hidden sm:block"
                  />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It <span className="text-gold-600">Works</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A simple four-step process to get your concerns addressed
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 border border-gray-100 text-center sm:text-left cursor-pointer">
                  <span className="text-3xl sm:text-5xl font-bold text-maroon-100">
                    {step.number}
                  </span>
                  <h3 className="text-base sm:text-xl font-semibold text-maroon-800 mt-1 sm:mt-2 mb-1 sm:mb-2">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-base text-gray-600">
                    {step.description}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gold-400"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-maroon-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Need to Track Your Feedback?
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            Already submitted a feedback? Use your tracking number to check the
            status and get updates on your concern.
          </p>
          <Link
            to="/track"
            className="inline-flex items-center space-x-2 bg-gold-500 text-maroon-900 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold hover:bg-gold-400 active:bg-gold-600 active:scale-95 transition-all duration-200 shadow-lg"
          >
            <Search size={20} />
            <span>Track Your Feedback</span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
