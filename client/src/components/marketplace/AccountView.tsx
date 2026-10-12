import React, { useState, useEffect, useCallback } from 'react';
import {
  AccountProfileDTO,
  ComparisonPriorityKey,
  UserDTO,
  AuthResponseDTO,
  ProductRequestDTO,
  RestockSubscriptionDTO,
} from '../../types/shopping';
import {
  loginApi,
  registerCustomerApi,
  changePasswordApi,
  submitProductRequestApi,
  fetchProductRequestsApi,
  fetchRestockSubscriptionsApi,
} from '../../api/client';
import {
  User,
  MapPin,
  Sparkles,
  CheckCircle2,
  Save,
  Lock,
  LogOut,
  Shield,
  Link2,
  Bell,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';

interface AccountViewProps {
  sessionId: string;
  authUser: UserDTO | null;
  account: AccountProfileDTO | null;
  categories: string[];
  onAuthSuccess: (authRes: AuthResponseDTO) => Promise<void> | void;
  onLogout: () => Promise<void> | void;
  onOpenAdminDashboard?: () => void;
  onSaveAccount: (
    update: Partial<{
      fullName: string;
      email: string;
      phone: string;
      defaultAddress: AccountProfileDTO['defaultAddress'];
      preferences: Partial<AccountProfileDTO['preferences']>;
    }>
  ) => Promise<AccountProfileDTO | null>;
}

export const AccountView: React.FC<AccountViewProps> = ({
  sessionId,
  authUser,
  account,
  categories,
  onAuthSuccess,
  onLogout,
  onOpenAdminDashboard,
  onSaveAccount,
}) => {
  // Auth state
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdMessage, setPwdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // Profile & Preferences state
  const [fullName, setFullName] = useState(account?.fullName || authUser?.fullName || '');
  const [email, setEmail] = useState(account?.email || authUser?.email || '');
  const [phone, setPhone] = useState(account?.phone || authUser?.phone || '');
  const [line1, setLine1] = useState(account?.defaultAddress?.line1 || '');
  const [line2, setLine2] = useState(account?.defaultAddress?.line2 || '');
  const [city, setCity] = useState(account?.defaultAddress?.city || '');
  const [state, setState] = useState(account?.defaultAddress?.state || '');
  const [postalCode, setPostalCode] = useState(account?.defaultAddress?.postalCode || '');
  const [priorityPreference, setPriorityPreference] = useState<ComparisonPriorityKey>(
    account?.preferences.priorityPreference || 'quality_performance'
  );
  const [preferredCategories, setPreferredCategories] = useState<string[]>(
    account?.preferences.preferredCategories || []
  );
  const [savedBanner, setSavedBanner] = useState(false);

  // Product Requests & Restock Subscriptions state
  const [myRequests, setMyRequests] = useState<ProductRequestDTO[]>([]);
  const [myRestocks, setMyRestocks] = useState<RestockSubscriptionDTO[]>([]);
  const [reqUrl, setReqUrl] = useState('');
  const [reqTitle, setReqTitle] = useState('');
  const [reqVariant, setReqVariant] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqFeedback, setReqFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [reqSubmitting, setReqSubmitting] = useState(false);

  useEffect(() => {
    if (account || authUser) {
      setFullName(account?.fullName || authUser?.fullName || '');
      setEmail(account?.email || authUser?.email || '');
      setPhone(account?.phone || authUser?.phone || '');
      setLine1(account?.defaultAddress?.line1 || '');
      setLine2(account?.defaultAddress?.line2 || '');
      setCity(account?.defaultAddress?.city || '');
      setState(account?.defaultAddress?.state || '');
      setPostalCode(account?.defaultAddress?.postalCode || '');
      setPriorityPreference(
        account?.preferences.priorityPreference || 'quality_performance'
      );
      setPreferredCategories(account?.preferences.preferredCategories || []);
    }
  }, [account, authUser]);

  const loadRequestsAndRestocks = useCallback(() => {
    fetchProductRequestsApi(sessionId)
      .then((res) => setMyRequests(res || []))
      .catch(() => {});
    fetchRestockSubscriptionsApi(sessionId)
      .then((res) => setMyRestocks(res || []))
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    loadRequestsAndRestocks();
  }, [loadRequestsAndRestocks]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await loginApi({
        usernameOrEmail: loginIdentifier,
        password: loginPassword,
        guestSessionId: sessionId,
      });
      await onAuthSuccess(res);
      setLoginPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await registerCustomerApi({
        username: regUsername,
        email: regEmail,
        password: regPassword,
        fullName: regFullName,
        phone: regPhone || undefined,
        guestSessionId: sessionId,
      });
      await onAuthSuccess(res);
      setRegPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMessage(null);
    setPwdSubmitting(true);
    try {
      await changePasswordApi(currentPassword, newPassword);
      setPwdMessage({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwdMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not change password.',
      });
    } finally {
      setPwdSubmitting(false);
    }
  };

  const handleCreateProductRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqFeedback(null);
    const contactEmail = email.trim() || authUser?.email || '';
    if (!contactEmail) {
      setReqFeedback({
        type: 'error',
        text: 'Please fill in your email address in Contact Information or sign in first.',
      });
      return;
    }
    setReqSubmitting(true);
    try {
      const res = await submitProductRequestApi({
        sessionId,
        contactEmail,
        sourceUrl: reqUrl.trim(),
        requestedName: reqTitle.trim() || undefined,
        desiredVariant: reqVariant.trim() || undefined,
        descriptionNotes: reqNote.trim() || undefined,
        consentGiven: true,
      });
      setReqFeedback({ type: 'success', text: res.confirmationMessage });
      setReqUrl('');
      setReqTitle('');
      setReqVariant('');
      setReqNote('');
      loadRequestsAndRestocks();
    } catch (err) {
      setReqFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not submit product request.',
      });
    } finally {
      setReqSubmitting(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setPreferredCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onSaveAccount({
      fullName,
      email,
      phone,
      defaultAddress:
        line1 && city && state && postalCode
          ? {
              line1,
              line2: line2 || undefined,
              city,
              state,
              postalCode,
              country: 'India',
            }
          : null,
      preferences: {
        priorityPreference,
        preferredCategories,
      },
    });
    if (res) {
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF8F5]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#DCE7D9] border border-[#C5D7C0] flex items-center justify-center text-[#254B3B]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-zinc-900">
                Account, Authentication &amp; Shopping Requests
              </h1>
              <p className="text-xs text-zinc-500">
                Sign in, manage your profile &amp; addresses, or track product requests and restock alerts
              </p>
            </div>
          </div>

          {authUser?.role === 'admin' && onOpenAdminDashboard && (
            <button
              type="button"
              onClick={onOpenAdminDashboard}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <Shield className="w-4 h-4" />
              <span>Open Admin Marketplace Dashboard</span>
            </button>
          )}
        </div>

        {/* Section 1: Authentication & Session Status */}
        <div
          data-testid="account-auth-section"
          className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E6E1D6] space-y-4 shadow-sm"
        >
          {authUser ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#DCE7D9] border border-[#C5D7C0] flex items-center justify-center text-[#254B3B] font-bold text-sm">
                    {authUser.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-900">{authUser.fullName}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          authUser.role === 'admin'
                            ? 'bg-[#254B3B] text-white'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {authUser.role}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      @{authUser.username} • {authUser.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onLogout()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF8F5] hover:bg-rose-50 border border-[#E6E1D6] hover:border-rose-200 text-xs font-semibold text-zinc-700 hover:text-rose-700 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>

              {authUser.mustChangePassword && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Security Notice: Default Demo Admin Password Active</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      You are signed in with the local development bootstrap credentials (<code>admin</code> / <code>admin</code>). Please update your password below for production safety.
                    </p>
                  </div>
                </div>
              )}

              {/* Change Password Form */}
              <form
                onSubmit={handleChangePassword}
                className="pt-3 border-t border-[#E6E1D6] space-y-3"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                  <KeyRound className="w-3.5 h-3.5 text-[#254B3B]" />
                  <span>Change Password</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    className="px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    className="px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                  />
                  <button
                    type="submit"
                    disabled={pwdSubmitting}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-[#254B3B] text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {pwdSubmitting ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
                {pwdMessage && (
                  <p
                    className={`text-xs font-medium ${
                      pwdMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {pwdMessage.text}
                  </p>
                )}
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#254B3B]" />
                  <h2 className="text-sm font-bold text-zinc-900">
                    Sign In or Create Customer Account
                  </h2>
                </div>
                <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E6E1D6]">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('login');
                      setAuthError(null);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      authTab === 'login'
                        ? 'bg-[#254B3B] text-white'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('register');
                      setAuthError(null);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      authTab === 'register'
                        ? 'bg-[#254B3B] text-white'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Register Customer
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {authError}
                </div>
              )}

              {authTab === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Username or Email
                      </label>
                      <input
                        type="text"
                        required
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder={
                          import.meta.env.DEV
                            ? 'e.g., admin or customer@example.com'
                            : 'e.g., customer@example.com'
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    {import.meta.env.DEV ? (
                      <span className="text-[11px] text-zinc-500">
                        Local Dev Admin Demo: username <code>admin</code> / password <code>admin</code>
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-500">
                        Sign in to sync your shopping cart and order history across devices.
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={authSubmitting}
                      className="px-5 py-2 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {authSubmitting ? 'Signing In...' : 'Sign In & Merge Guest Cart'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Username *
                      </label>
                      <input
                        type="text"
                        required
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="aarav_sharma"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="aarav@example.com"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        placeholder="Aarav Sharma"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Phone Number (Optional)
                      </label>
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+91 9876543210"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Password (min 6 characters) *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Create password"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={authSubmitting}
                      className="px-5 py-2 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {authSubmitting ? 'Creating Account...' : 'Create Customer Account'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {savedBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>Profile, default shipping address, and shopping priorities saved!</span>
          </div>
        )}

        {/* Section 2: Request a Missing Product & View Restock Alerts (Phase 10) */}
        <div
          data-testid="account-product-requests-section"
          className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E6E1D6] space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#254B3B]" />
              <span>Request a Missing Product &amp; Restock Notifications</span>
            </h2>
            <span className="text-[11px] text-zinc-500">
              Can&apos;t find an item in our curated catalogue? Paste its URL below.
            </span>
          </div>

          <form
            onSubmit={handleCreateProductRequest}
            className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="url"
                required
                value={reqUrl}
                onChange={(e) => setReqUrl(e.target.value)}
                placeholder="Product URL (https://...)"
                className="sm:col-span-2 px-3 py-2 rounded-xl bg-white border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
              />
              <input
                type="text"
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                placeholder="Product Name / Brand"
                className="px-3 py-2 rounded-xl bg-white border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={reqVariant}
                onChange={(e) => setReqVariant(e.target.value)}
                placeholder="Desired Size / Colour (optional)"
                className="px-3 py-2 rounded-xl bg-white border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
              />
              <input
                type="text"
                value={reqNote}
                onChange={(e) => setReqNote(e.target.value)}
                placeholder="Notes or target price (optional)"
                className="px-3 py-2 rounded-xl bg-white border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
              />
              <button
                type="submit"
                disabled={reqSubmitting}
                className="px-4 py-2 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {reqSubmitting ? 'Submitting...' : 'Request This Product'}
              </button>
            </div>
            {reqFeedback && (
              <div
                className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                  reqFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{reqFeedback.text}</span>
              </div>
            )}
          </form>

          {/* Existing Product Requests & Restock Subscriptions */}
          {(myRequests.length > 0 || myRestocks.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                  My Missing-Product Requests ({myRequests.length})
                </h3>
                {myRequests.length === 0 ? (
                  <p className="text-xs text-zinc-400">No requests submitted yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {myRequests.map((r) => (
                      <div
                        key={r.id}
                        className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-zinc-900 truncate">
                            {r.requestedName || r.normalizedUrl}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#DCE7D9] text-[#254B3B] text-[10px] font-bold">
                            {r.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate">{r.sourceUrl}</p>
                        {r.desiredVariant && (
                          <p className="text-[10px] text-zinc-600">
                            Variant: {r.desiredVariant}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                  <span>My Restock Subscriptions ({myRestocks.length})</span>
                </h3>
                {myRestocks.length === 0 ? (
                  <p className="text-xs text-zinc-400">No active restock alerts.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {myRestocks.map((sub) => (
                      <div
                        key={sub.id}
                        className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-zinc-900 truncate">
                            {sub.productName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.status === 'EligibleForNotification' || sub.status === 'Notified'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </div>
                        {sub.variantLabel && (
                          <p className="text-[10px] text-zinc-600">{sub.variantLabel}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Profile, Default Shipping Address & Comparison Priorities */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Details */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E6E1D6] space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <User className="w-4 h-4 text-[#254B3B]" />
              <span>Contact Information</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Aarav Sharma"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aarav@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                />
              </div>
            </div>
          </div>

          {/* Default Delivery Address */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E6E1D6] space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#254B3B]" />
              <span>Default Delivery Address</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  placeholder="42 Indiranagar 100 Feet Road"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  value={line2}
                  onChange={(e) => setLine2(e.target.value)}
                  placeholder="Apartment, Suite, or Landmark"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Bengaluru"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Karnataka"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                  PIN Code
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="560038"
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF8F5] border border-[#E6E1D6] text-xs text-zinc-900 focus:outline-none focus:border-[#254B3B]"
                />
              </div>
            </div>
          </div>

          {/* AI Comparison & Shopping Priorities */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E6E1D6] space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#254B3B]" />
              <span>Default Comparison Verdict Priority</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                {
                  key: 'budget' as const,
                  title: 'Best for Budget',
                  desc: 'Prioritize lowest upfront price and strong value-per-rupee.',
                },
                {
                  key: 'quality_performance' as const,
                  title: 'Quality & Performance',
                  desc: 'Prioritize highest customer ratings, durability, and technical specs.',
                },
                {
                  key: 'sustainability_certifications' as const,
                  title: 'Sustainability & Verified Certifications',
                  desc: 'Prioritize verified certifications and audit green/natural claims.',
                },
                {
                  key: 'everyday_convenience' as const,
                  title: 'Everyday Convenience',
                  desc: 'Prioritize ease of use, versatility, and low maintenance.',
                },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPriorityPreference(opt.key)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    priorityPreference === opt.key
                      ? 'bg-[#DCE7D9]/40 border-[#254B3B] text-[#254B3B] ring-1 ring-[#C5D7C0]'
                      : 'bg-[#FAF8F5] hover:bg-white border-[#E6E1D6] text-zinc-800'
                  }`}
                >
                  <p className="text-xs font-bold">{opt.title}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            <div className="pt-2 space-y-2">
              <label className="block text-xs font-semibold text-zinc-700">
                Favorite Shopping Categories
              </label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => {
                  const selected = preferredCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize border transition-colors ${
                        selected
                          ? 'bg-[#254B3B] border-[#254B3B] text-white'
                          : 'bg-[#FAF8F5] border-[#E6E1D6] text-zinc-700 hover:bg-[#F3EFE6]'
                      }`}
                    >
                      {cat.replace(/-/g, ' ')}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#254B3B] hover:bg-[#1C3A2E] text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Save Profile &amp; Preferences</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
