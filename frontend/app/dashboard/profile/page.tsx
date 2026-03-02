"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth/auth-context";
import {
  changeAnonPassword,
  fetchMyProfile,
  listMyComplaints,
  type AuthUser,
  type ComplaintRecord,
} from "@/lib/auth-api";

const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function complaintDisplayStatus(complaint: ComplaintRecord): "pending" | "resolved" | "rejected" {
  if (complaint.display_status) return complaint.display_status;
  if (complaint.status === "resolved") return "resolved";
  if (complaint.status === "rejected") return "rejected";
  return "pending";
}

export default function ProfilePage() {
  const [open, setOpen] = useState(false);
  const { logout, user } = useAuth();

  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [profileData, complaintData] = await Promise.all([fetchMyProfile(), listMyComplaints()]);
        if (!active) return;
        setProfile(profileData);
        setComplaints(complaintData);
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load profile.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const links = [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "File Complaint", href: "/dashboard/file-complaint", icon: <FilePlus2 className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "My Complaints", href: "/dashboard/my-complaints", icon: <ClipboardList className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Messages", href: "/dashboard/messages", icon: <MessageSquare className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Ethos AI", href: "/dashboard/support", icon: <Bot className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Profile", href: "/dashboard/profile", icon: <UserRound className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Logout", href: "#", onClick: logout, icon: <LogOut className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
  ];

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return Math.min(score, 4);
  }, [newPassword]);

  const passwordMatches = confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmitPassword =
    currentPassword.length >= 8 &&
    newPassword.length >= 8 &&
    passwordMatches &&
    !passwordSubmitting;

  const resolvedCount = complaints.filter((item) => complaintDisplayStatus(item) === "resolved").length;
  const rejectedCount = complaints.filter((item) => complaintDisplayStatus(item) === "rejected").length;

  const accountCreated = profile?.created_at || null;
  const lastLogin = profile?.last_login || null;
  const credibilityScore = typeof profile?.credibility_score === "number" ? Math.round(profile.credibility_score) : 100;
  const trustFlag = Boolean(profile?.trust_flag);

  const handlePasswordSave = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwordMatches) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError("New password must be different from current password.");
      return;
    }

    setPasswordSubmitting(true);
    try {
      const response = await changeAnonPassword({ currentPassword, newPassword });
      setPasswordSuccess(response.message || "Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const alias = profile?.anon_alias || user?.anon_alias || "N/A";
  const accountStatus = trustFlag ? "Trust Review" : "Active";
  const standingLabel = trustFlag ? "Watchlisted" : "Good Standing";

  return (
    <main className="employee-theme-page h-screen w-screen overflow-hidden bg-linear-to-b from-slate-100 via-white to-slate-50">
      <div className="flex h-full w-full flex-col overflow-hidden border border-slate-200 bg-white/90 shadow-2xl shadow-slate-900/5 backdrop-blur-xl md:flex-row">
        <Sidebar open={open} setOpen={setOpen}>
          <SidebarBody className="justify-between gap-10">
            <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
              {open ? <BrandLogo /> : <BrandIcon />}
              <div className="mt-8 flex flex-col gap-2">
                {links.map((link, idx) => (
                  <SidebarLink key={idx} link={link} />
                ))}
              </div>
            </div>
            <SidebarLink
              link={{
                label: "Employee",
                href: "/dashboard",
                icon: (
                  <Image
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80"
                    className="h-7 w-7 flex-shrink-0 rounded-full"
                    width={50}
                    height={50}
                    alt="Employee avatar"
                  />
                ),
              }}
            />
          </SidebarBody>
        </Sidebar>

        <section className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto w-full max-w-[90rem] space-y-5">
            <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h1 className="text-2xl font-black tracking-wide text-slate-900">Profile & Security</h1>
              <p className="mt-1 text-sm text-slate-600">Manage your anonymous account with secure controls and transparent trust indicators.</p>
            </header>

            {loadError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div> : null}

            <article className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">Credibility & Trust</h2>
                  <p className="mt-1 text-sm text-slate-700">Your credibility score helps keep complaint handling fair, transparent, and misuse-resistant.</p>
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{standingLabel}</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Credibility Score</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{credibilityScore} / 100</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Status</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{accountStatus}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Verified / Rejected</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{resolvedCount} / {rejectedCount}</p>
                </div>
              </div>
            </article>

            <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
              <section className="space-y-5">
                <article className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm">
                  <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">Anonymous Identity Card</h2>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    <InfoTile label="Anonymous Alias" value={alias} />
                    <InfoTile label="Account Status" value={accountStatus} />
                    <InfoTile label="Account Created" value={loading ? "Loading..." : formatDate(accountCreated)} />
                    <InfoTile label="Last Login" value={loading ? "Loading..." : formatDate(lastLogin)} />
                    <InfoTile label="Total Complaints Filed" value={String(complaints.length)} />
                    <InfoTile label="Trust Flag" value={trustFlag ? "Yes" : "No"} />
                  </div>
                  <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                    <ShieldCheck className="h-4 w-4 text-slate-600" />
                    Your real identity is securely stored and never visible to HR.
                  </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 shadow-sm">
                  <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">Data Privacy Information</h2>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    <li className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <ShieldCheck className="h-4 w-4 text-slate-600" />
                      <span>Identity stored separately</span>
                    </li>
                    <li className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <ShieldCheck className="h-4 w-4 text-slate-600" />
                      <span>Complaints linked via random IDs</span>
                    </li>
                    <li className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <ShieldCheck className="h-4 w-4 text-slate-600" />
                      <span>Encrypted storage (AES-256)</span>
                    </li>
                    <li className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <ShieldCheck className="h-4 w-4 text-slate-600" />
                      <span>Evidence hashed (SHA-256)</span>
                    </li>
                  </ul>
                </article>
              </section>

              <article className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Account Security</h2>

                <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Change Password</h3>
                  <div className="mt-3 grid gap-3">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current Password"
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-500"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New Password"
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-500"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm Password"
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-500"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700">
                      Strength: {strengthLabels[passwordStrength]}
                    </span>
                    {confirmPassword.length > 0 ? (
                      <span
                        className={`rounded-full border px-2 py-1 font-semibold ${
                          passwordMatches
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {passwordMatches ? "Passwords match" : "Passwords do not match"}
                      </span>
                    ) : null}
                  </div>

                  {passwordError ? (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                      {passwordError}
                    </p>
                  ) : null}
                  {passwordSuccess ? (
                    <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                      {passwordSuccess}
                    </p>
                  ) : null}

                  <button
                    onClick={handlePasswordSave}
                    disabled={!canSubmitPassword}
                    className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {passwordSubmitting ? "Updating..." : "Update Password"}
                  </button>
                </section>

                <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Session Overview</h3>
                  <p className="mt-2 text-xs text-slate-600">Last Login: {loading ? "Loading..." : formatDate(lastLogin)}</p>
                  <p className="mt-1 text-xs text-slate-600">This panel reflects server-side account metadata from your anonymous profile.</p>
                </section>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

const BrandLogo = () => {
  return (
    <Link href="/" className="flex items-center py-1 text-sm">
      <span className="font-semibold tracking-[0.14em] text-white">ETHOS</span>
    </Link>
  );
};

const BrandIcon = () => {
  return (
    <Link href="/" className="flex items-center py-1 text-sm">
      <ShieldCheck className="h-5 w-5 text-white" />
    </Link>
  );
};
