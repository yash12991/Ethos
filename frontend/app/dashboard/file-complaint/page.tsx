"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import TimePicker from "@/components/ui/time-picker";
import { useAuth } from "@/components/auth/auth-context";
import { createComplaint, uploadEvidence } from "@/lib/auth-api";

type HarassmentType =
  | ""
  | "Verbal"
  | "Physical"
  | "Sexual"
  | "Mental"
  | "Discrimination"
  | "Other";

type IncidentLocation = "" | "Office" | "Remote" | "Event" | "Other";

type YesNo = "" | "Yes" | "No";

type EvidenceFile = {
  id: string;
  file: File;
  name: string;
  sizeLabel: string;
  progress: number;
  status: "queued" | "uploading" | "uploaded" | "failed";
};

type ComplaintDraft = {
  incidentDate: string;
  incidentTime: string;
  location: IncidentLocation;
  locationOther: string;
  department: string;
  harassmentType: HarassmentType;
  accusedName: string;
  accusedRole: string;
  accusedDepartment: string;
  repeatedBehavior: YesNo;
  description: string;
  witnessName: string;
  witnessDepartment: string;
  witnessContactKnown: YesNo;
  declarationChecked: boolean;
};

const DRAFT_KEY = "ethos-file-complaint-draft";

const initialDraft: ComplaintDraft = {
  incidentDate: "",
  incidentTime: "",
  location: "",
  locationOther: "",
  department: "",
  harassmentType: "",
  accusedName: "",
  accusedRole: "",
  accusedDepartment: "",
  repeatedBehavior: "",
  description: "",
  witnessName: "",
  witnessDepartment: "",
  witnessContactKnown: "",
  declarationChecked: false,
};

const fieldClassName =
  "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-slate-500";

const STEPS = [
  "Incident Details",
  "Accused Info",
  "Incident Description",
  "Evidence Upload",
  "Witness Info",
  "Declaration",
] as const;

export default function FileComplaintPage() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const [draft, setDraft] = useState<ComplaintDraft>(initialDraft);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const links = [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "File Complaint", href: "/dashboard/file-complaint", icon: <FilePlus2 className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "My Complaints", href: "/dashboard/my-complaints", icon: <ClipboardList className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Messages", href: "/dashboard/messages", icon: <MessageSquare className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Ethos AI", href: "/dashboard/support", icon: <Bot className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Profile", href: "/dashboard/profile", icon: <UserRound className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
    { label: "Logout", href: "#", onClick: logout, icon: <LogOut className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" /> },
  ];

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as ComplaintDraft;
      setDraft({ ...initialDraft, ...parsed });
    } catch {
      setDraft(initialDraft);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const isHighSeverity =
    draft.repeatedBehavior === "Yes" && draft.harassmentType === "Physical";

  const descriptionCount = draft.description.length;
  const todayIso = new Date().toISOString().split("T")[0];

  const validateStep = (stepNumber = currentStep) => {
    const nextErrors: string[] = [];

    if (stepNumber === 1) {
      if (!draft.incidentDate) nextErrors.push("Incident Date is required.");
      if (draft.incidentDate && draft.incidentDate > todayIso) {
        nextErrors.push("Incident Date cannot be in the future.");
      }
      if (!draft.location) nextErrors.push("Incident Location is required.");
      if (draft.location === "Other" && !draft.locationOther.trim()) {
        nextErrors.push("Please provide details for Other location.");
      }
      if (!draft.harassmentType) nextErrors.push("Type of Harassment is required.");
    }

    if (stepNumber === 3 && draft.description.trim().length < 100) {
      nextErrors.push("Incident Description must be at least 100 characters.");
    }

    if (stepNumber === STEPS.length && !draft.declarationChecked) {
      nextErrors.push("Please confirm the declaration before submitting.");
    }

    setErrors(nextErrors);
    return nextErrors.length === 0;
  };

  const validateAll = () => {
    const nextErrors: string[] = [];
    if (!draft.incidentDate) nextErrors.push("Incident Date is required.");
    if (draft.incidentDate && draft.incidentDate > todayIso) {
      nextErrors.push("Incident Date cannot be in the future.");
    }
    if (!draft.location) nextErrors.push("Incident Location is required.");
    if (draft.location === "Other" && !draft.locationOther.trim()) {
      nextErrors.push("Please provide details for Other location.");
    }
    if (!draft.harassmentType) nextErrors.push("Type of Harassment is required.");
    if (draft.description.trim().length < 100) {
      nextErrors.push("Incident Description must be at least 100 characters.");
    }
    if (!draft.declarationChecked) {
      nextErrors.push("Please confirm the declaration before submitting.");
    }
    setErrors(nextErrors);
    return nextErrors.length === 0;
  };

  const handleFileInput = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      sizeLabel: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      progress: 0,
      status: "queued" as const,
    }));
    setEvidenceFiles((prev) => [...prev, ...next]);
  };

  const removeEvidence = (id: string) => {
    setEvidenceFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const toHex = (buffer: ArrayBuffer) =>
    Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

  const createAccusedHash = async () => {
    const fingerprint = `${draft.accusedName}|${draft.accusedRole}|${draft.accusedDepartment}|${draft.department}`
      .trim()
      .toLowerCase();
    const source = fingerprint.length > 3 ? fingerprint : `unknown-${Date.now()}`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    return toHex(digest);
  };

  const submitComplaint = async () => {
    try {
      setSubmitting(true);
      setSubmitError(null);
      setSubmitWarning(null);
      const accusedEmployeeHash = await createAccusedHash();
      const locationValue = draft.location === "Other" ? draft.locationOther : draft.location;

      const created = await createComplaint({
        accused_employee_hash: accusedEmployeeHash,
        description: draft.description.trim(),
        incident_date: draft.incidentDate || undefined,
        location: locationValue || undefined,
        evidence_count: evidenceFiles.length,
        has_witness: Boolean(draft.witnessName || draft.witnessContactKnown === "Yes"),
      });

      const failedUploads: string[] = [];
      for (const evidence of evidenceFiles) {
        setEvidenceFiles((prev) =>
          prev.map((item) =>
            item.id === evidence.id ? { ...item, progress: 35, status: "uploading" } : item
          )
        );

        try {
          await uploadEvidence(created.complaint_code, evidence.file);
          setEvidenceFiles((prev) =>
            prev.map((item) =>
              item.id === evidence.id ? { ...item, progress: 100, status: "uploaded" } : item
            )
          );
        } catch (uploadErr) {
          failedUploads.push(
            `${evidence.name} (${uploadErr instanceof Error ? uploadErr.message : "upload failed"})`
          );
          setEvidenceFiles((prev) =>
            prev.map((item) =>
              item.id === evidence.id ? { ...item, progress: 0, status: "failed" } : item
            )
          );
        }
      }

      if (failedUploads.length > 0) {
        setSubmitWarning(
          `Complaint submitted as ${created.complaint_code}, but ${failedUploads.length} evidence file(s) failed: ${failedUploads.join(", ")}`
        );
      }

      setSubmittedId(created.complaint_code);
      localStorage.removeItem(DRAFT_KEY);
      setShowConfirm(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  const severityHint = useMemo(() => {
    if (!isHighSeverity) return null;
    return "This appears to be a high severity case.";
  }, [isHighSeverity]);

  if (submittedId) {
    return (
      <main className="employee-theme-page h-screen w-screen overflow-hidden bg-linear-to-b from-slate-100 via-white to-slate-50">
        <div className="flex h-full w-full items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="mt-3 text-2xl font-black text-slate-900">Complaint Submitted Successfully</h1>
            <p className="mt-2 text-sm text-slate-600">Your Complaint ID: <span className="font-bold text-slate-900">{submittedId}</span></p>
            <p className="mt-1 text-sm text-slate-600">You can track status from My Complaints.</p>
            {submitWarning ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {submitWarning}
              </p>
            ) : null}
            <Link
              href="/dashboard/my-complaints"
              className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Go to My Complaints
            </Link>
          </div>
        </div>
      </main>
    );
  }

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
          <div className="mx-auto w-full max-w-[70rem] space-y-5">
            <div className="rounded-2xl border border-sky-200 bg-linear-to-r from-sky-50 to-indigo-50 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ShieldCheck className="h-4 w-4 text-sky-700" />
                Your identity will remain anonymous.
              </p>
              <p className="mt-1 text-sm text-slate-600">
                HR will only see a complaint ID — not your name, email, or employee ID.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h1 className="text-2xl font-black tracking-wide text-slate-900">File Complaint</h1>
              <p className="mt-1 text-sm text-slate-600">Provide clear details so HR can review your case effectively and fairly.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                {STEPS.map((step, idx) => {
                  const stepNumber = idx + 1;
                  const isActive = currentStep === stepNumber;
                  const isDone = currentStep > stepNumber;
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => {
                        if (stepNumber <= currentStep) {
                          setCurrentStep(stepNumber);
                          setErrors([]);
                        }
                      }}
                      className={`rounded-full border px-2 py-1 transition ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : isDone
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-300 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {stepNumber}. {step}
                    </button>
                  );
                })}
              </div>
            </div>

            {currentStep === 1 && (
              <SectionCard title="Incident Details">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Incident Date" required>
                    <input
                      type="date"
                      value={draft.incidentDate}
                      max={todayIso}
                      onChange={(e) => setDraft((prev) => ({ ...prev, incidentDate: e.target.value }))}
                      className={fieldClassName}
                    />
                  </Field>

                  <Field label="Incident Time (Optional)">
                    <div className="flex items-center gap-2">
                      <TimePicker
                        value={draft.incidentTime}
                        onChange={(timeValue) =>
                          setDraft((prev) =>
                            prev.incidentTime === timeValue ? prev : { ...prev, incidentTime: timeValue }
                          )
                        }
                        className="flex-1"
                        placeholder="Select time"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const hh = String(now.getHours()).padStart(2, "0");
                          const mm = String(now.getMinutes()).padStart(2, "0");
                          setDraft((prev) => ({ ...prev, incidentTime: `${hh}:${mm}` }));
                        }}
                        className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Now
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Tip: use the clock field to select time.
                    </p>
                  </Field>

                  <Field label="Location" required>
                    <select
                      value={draft.location}
                      onChange={(e) => setDraft((prev) => ({ ...prev, location: e.target.value as IncidentLocation }))}
                      className={fieldClassName}
                    >
                      <option value="">Select location</option>
                      <option value="Office">Office</option>
                      <option value="Remote">Remote</option>
                      <option value="Event">Event</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>

                  <Field label="Department (Optional)">
                    <input
                      value={draft.department}
                      onChange={(e) => setDraft((prev) => ({ ...prev, department: e.target.value }))}
                      placeholder="e.g. Engineering"
                      className={fieldClassName}
                    />
                  </Field>

                  {draft.location === "Other" && (
                    <Field label="Other Location Detail" required>
                      <input
                        value={draft.locationOther}
                        onChange={(e) => setDraft((prev) => ({ ...prev, locationOther: e.target.value }))}
                        placeholder="Please specify"
                        className={fieldClassName}
                      />
                    </Field>
                  )}

                  <Field label="Type of Harassment" required>
                    <select
                      value={draft.harassmentType}
                      onChange={(e) => setDraft((prev) => ({ ...prev, harassmentType: e.target.value as HarassmentType }))}
                      className={fieldClassName}
                    >
                      <option value="">Select type</option>
                      <option value="Verbal">Verbal</option>
                      <option value="Physical">Physical</option>
                      <option value="Sexual">Sexual</option>
                      <option value="Mental">Mental</option>
                      <option value="Discrimination">Discrimination</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                </div>
              </SectionCard>
            )}

            {currentStep === 2 && (
              <SectionCard title="Accused Information">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Accused Name (Optional)">
                    <input
                      value={draft.accusedName}
                      onChange={(e) => setDraft((prev) => ({ ...prev, accusedName: e.target.value }))}
                      className={fieldClassName}
                      placeholder="Leave blank if unknown"
                    />
                  </Field>
                  <Field label="Accused Role / Designation">
                    <input
                      value={draft.accusedRole}
                      onChange={(e) => setDraft((prev) => ({ ...prev, accusedRole: e.target.value }))}
                      className={fieldClassName}
                    />
                  </Field>
                  <Field label="Accused Department">
                    <input
                      value={draft.accusedDepartment}
                      onChange={(e) => setDraft((prev) => ({ ...prev, accusedDepartment: e.target.value }))}
                      className={fieldClassName}
                    />
                  </Field>
                  <Field label="Is this repeated behavior?">
                    <select
                      value={draft.repeatedBehavior}
                      onChange={(e) => setDraft((prev) => ({ ...prev, repeatedBehavior: e.target.value as YesNo }))}
                      className={fieldClassName}
                    >
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </Field>
                </div>

                {severityHint && (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    <AlertTriangle className="h-4 w-4" /> {severityHint}
                  </p>
                )}
              </SectionCard>
            )}

            {currentStep === 3 && (
              <SectionCard title="Incident Description">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Describe what happened. Include what occurred, who was present, any witnesses, and prior incidents.
                </label>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value.slice(0, 2000) }))}
                  className="mt-2 min-h-[180px] w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-slate-500"
                  placeholder="Write detailed incident context here..."
                />
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>Minimum 100 characters</span>
                  <span>{descriptionCount} / 2000</span>
                </div>
              </SectionCard>
            )}

            {currentStep === 4 && (
              <SectionCard title="Evidence Upload">
                <p className="text-sm text-slate-600">
                  Uploading evidence strengthens your case. Files are encrypted and securely stored.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Upload className="h-4 w-4" />
                    Upload Files
                    <input
                      type="file"
                      multiple
                      accept=".png,.jpg,.jpeg,.pdf,.mp3,.mp4"
                      className="hidden"
                      onChange={(e) => handleFileInput(e.target.files)}
                    />
                  </label>
                  <span className="text-xs text-slate-500">Supported: JPG, PNG, PDF, MP3, MP4</span>
                </div>

                {evidenceFiles.length === 0 && (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    You can submit without evidence, but attaching proof improves investigation speed.
                  </p>
                )}

                <div className="mt-4 space-y-2">
                  {evidenceFiles.map((file) => (
                    <div key={file.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                          <p className="text-xs text-slate-500">{file.sizeLabel}</p>
                        </div>
                        <button
                          onClick={() => removeEvidence(file.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <X className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                      {file.status !== "queued" ? (
                        <>
                          <div className="mt-2 h-2 rounded-full bg-slate-200">
                            <div className="h-2 rounded-full bg-slate-800" style={{ width: `${file.progress}%` }} />
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">Upload progress: {file.progress}%</p>
                        </>
                      ) : null}
                      <p
                        className={`mt-1 text-[11px] ${
                          file.status === "failed" ? "text-red-600" : "text-slate-500"
                        }`}
                      >
                        {file.status === "queued" && "Queued: uploads after final Submit Complaint."}
                        {file.status === "uploading" && "Uploading now..."}
                        {file.status === "uploaded" && "Uploaded successfully."}
                        {file.status === "failed" && "Upload failed for this file."}
                      </p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {currentStep === 5 && (
              <SectionCard title="Witness Information (Optional)">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Witness Name (Optional)">
                    <input
                      value={draft.witnessName}
                      onChange={(e) => setDraft((prev) => ({ ...prev, witnessName: e.target.value }))}
                      className={fieldClassName}
                    />
                  </Field>

                  <Field label="Witness Department">
                    <input
                      value={draft.witnessDepartment}
                      onChange={(e) => setDraft((prev) => ({ ...prev, witnessDepartment: e.target.value }))}
                      className={fieldClassName}
                    />
                  </Field>

                  <Field label="Contact known? (Yes/No)">
                    <select
                      value={draft.witnessContactKnown}
                      onChange={(e) => setDraft((prev) => ({ ...prev, witnessContactKnown: e.target.value as YesNo }))}
                      className={fieldClassName}
                    >
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </Field>
                </div>
              </SectionCard>
            )}

            {currentStep === 6 && (
              <SectionCard title="Confidentiality & Declaration">
                <label className="inline-flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.declarationChecked}
                    onChange={(e) => setDraft((prev) => ({ ...prev, declarationChecked: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  I confirm that the information provided is true to the best of my knowledge.
                </label>
                <p className="mt-2 text-xs text-slate-500">
                  False or malicious complaints may affect credibility score. All complaints are reviewed by HR and committee.
                </p>
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-900">
                  After filing complaint, you cannot delete it.
                </p>
              </SectionCard>
            )}

            {errors.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-semibold">Please fix the following before submission:</p>
                <ul className="mt-1 list-disc pl-5">
                  {errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {submitError}
              </div>
            ) : null}

            <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">Draft is auto-saved.</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setErrors([]);
                      setCurrentStep((prev) => Math.max(1, prev - 1));
                    }}
                    disabled={currentStep === 1}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>

                  {currentStep < STEPS.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!validateStep()) return;
                        setCurrentStep((prev) => Math.min(STEPS.length, prev + 1));
                      }}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Next Step
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!validateAll()) return;
                        setShowConfirm(true);
                      }}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Submit Complaint
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Confirm Submission</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to submit this complaint? Once submitted, it cannot be deleted.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  void submitComplaint();
                }}
                disabled={submitting}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Confirm Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span className="mb-1.5 block">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
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
