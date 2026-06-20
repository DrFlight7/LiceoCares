import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { GraduationCap, AlertCircle, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
const SITEVERIFY_WORKER_URL = "https://turnstile-siteverify-liceocares.harleybusa82.workers.dev";

const StudentLogin = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [allowGuestLogin, setAllowGuestLogin] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);
  const { signInWithGoogle, user, isStudent, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const wrongRoleError = sessionStorage.getItem("wrongRoleError");
    if (wrongRoleError) {
      setError(wrongRoleError);
      sessionStorage.removeItem("wrongRoleError");
    }
    if (!authLoading && user && isStudent) {
      navigate("/my-tickets", { replace: true });
    }
    supabase
      .from("system_settings")
      .select("allow_guest_login")
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setAllowGuestLogin(data.allow_guest_login ?? false);
        } else {
          setAllowGuestLogin(false);
        }
      });
  }, [user, isStudent, authLoading, navigate]);

  // Load Cloudflare Turnstile script
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      setTurnstileReady(false);
      return;
    }

    const existingScript = document.getElementById("cf-turnstile-script");
    if (existingScript) {
      if (window.turnstile) setTurnstileReady(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "cf-turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => setTurnstileReady(true);
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  // Render widget once script is ready
  useEffect(() => {
    if (!turnstileReady || !turnstileRef.current || !TURNSTILE_SITE_KEY) return;
    if (widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "light",
      "data-action": "turnstile-spin-v1",
      callback: (token) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(null),
      "error-callback": () => setTurnstileToken(null),
    });
  }, [turnstileReady]);

  const resetTurnstile = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      setTurnstileToken(null);
    }
  }, []);

  const captchaEnabled = !!TURNSTILE_SITE_KEY;
  const canSignIn = !loading && (!captchaEnabled || !!turnstileToken);

  const handleGoogleSignIn = async () => {
    setError("");

    if (captchaEnabled && !turnstileToken) {
      setError("Please complete the security check before signing in.");
      return;
    }

    setLoading(true);

    // Server-side Turnstile verification via Cloudflare Worker
    if (captchaEnabled && turnstileToken) {
      try {
        const verifyRes = await fetch(SITEVERIFY_WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: turnstileToken }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          setError("Security verification failed. Please try again.");
          setLoading(false);
          resetTurnstile();
          return;
        }
      } catch {
        setError("Could not verify security check. Please try again.");
        setLoading(false);
        resetTurnstile();
        return;
      }
    }

    try {
      const { error: signInError } = await signInWithGoogle();
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        resetTurnstile();
      }
    } catch (err) {
      setError("An error occurred during sign in. Please try again.");
      setLoading(false);
      resetTurnstile();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-maroon-800 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg p-1">
              <img src="/ldcu.ico" alt="LDCU Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Student Portal</h2>
            <p className="text-gray-600 mt-2">
              Sign in with your Liceo email to access your tickets
            </p>
          </div>

          {/* Info Banner */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start space-x-3">
              <Mail size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-800 text-sm font-medium">Liceo Students Only</p>
                <p className="text-blue-600 text-xs mt-1">
                  Only emails ending with <strong>@liceo.edu.ph</strong> can sign in.
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Cloudflare Turnstile CAPTCHA */}
          {captchaEnabled && (
            <div className="flex flex-col items-center space-y-2 mb-4">
              <div ref={turnstileRef} />
              {turnstileToken && (
                <div className="flex items-center space-x-1.5 text-green-600 text-xs font-medium">
                  <ShieldCheck size={14} />
                  <span>Security check passed</span>
                </div>
              )}
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            id="student-google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={!canSignIn}
            className="w-full bg-white border-2 border-gray-200 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 focus:ring-4 focus:ring-gray-100 transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-500 border-t-transparent"></div>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Divider + Guest Login (only if enabled) */}
          {allowGuestLogin && (
            <>
              <div className="my-6 flex items-center">
                <div className="flex-1 border-t border-gray-200"></div>
                <span className="px-4 text-sm text-gray-500">or</span>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>
              <button
                onClick={() => navigate("/")}
                className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-200 transition-all duration-200"
              >
                Continue as Guest
              </button>
            </>
          )}

          {/* Footer */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-500">
              Students can track all their submitted complaints in one place.
            </p>
            <p className="text-xs text-gray-400">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;
