import Cookies from "js-cookie";

export type AuthUser = {
  id: string;
  role: string;
  userType?: "anon" | "hr";
  anon_alias?: string;
  name?: string;
  email?: string;
  credibility_score?: number;
  trust_flag?: boolean;
  created_at?: string;
  last_login?: string | null;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export class ApiRequestError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export type AuthResponse = {
  success: boolean;
  message?: string;
  data?: {
    requiresOtp?: boolean;
    challengeId?: string;
    expiresAt?: number;
    otpPreview?: string;
    email?: string;
    user?: AuthUser;
    tokens?: AuthTokens;
  };
};

type RegisterPayload = {
  alias: string;
  password: string;
};

type LoginPayload = {
  alias: string;
  password: string;
};

type HrLoginPayload = {
  email: string;
  password: string;
};

export type ComplaintRecord = {
  id: string;
  complaint_code: string;
  anon_user_id: string;
  accused_employee_hash: string;
  incident_date: string | null;
  location: string | null;
  description: string;
  status: "submitted" | "under_review" | "resolved" | "rejected";
  display_status?: "pending" | "resolved" | "rejected";
  rejection_type?: "insufficient" | "false" | "malicious" | null;
  severity_score: number;
  credibility_score?: number;
  created_at: string;
  updated_at: string;
};

export type HrComplaintRecord = Omit<ComplaintRecord, "anon_user_id">;

export type RejectionType = "insufficient" | "false" | "malicious";
export type CaseWorkflowStatus =
  | "open"
  | "in_progress"
  | "under_review"
  | "resolved"
  | "rejected"
  | "resolved_accepted"
  | "resolved_rejected"
  | "reopened";
export type HrAssignedUser = { id: string; name: string };
export type HrQueueRecord = HrComplaintRecord & {
  workflow_status?: CaseWorkflowStatus;
  status_label?: string;
  can_accept?: boolean;
  can_view?: boolean;
  assigned_hr?: HrAssignedUser | null;
  incident_summary?: string | null;
};

export type HrNotificationRecord = {
  complaint_code: string;
  workflow_status: CaseWorkflowStatus;
  status: ComplaintRecord["status"];
  investigator_decision_notes: string | null;
  investigator_decision_at: string | null;
  assigned_hr: HrAssignedUser;
  my_vote: "support" | "oppose" | null;
  my_vote_updated_at: string | null;
  updated_at: string;
};

export type HrNotificationDetail = HrComplaintRecord & {
  workflow_status: CaseWorkflowStatus;
  assigned_hr: HrAssignedUser;
  my_vote: "support" | "oppose" | null;
  my_vote_updated_at: string | null;
  investigator_decision_notes: string | null;
  investigator_decision_at: string | null;
};

export type VerdictRecord = {
  id: string;
  complaint_id: string;
  verdict: "guilty" | "not_guilty" | "insufficient_evidence";
  notes: string | null;
  decided_by: string;
  decided_at: string;
};

export type AccusedPatternRecord = {
  accused_employee_hash: string;
  guilty_count: number;
  credibility_score: number;
  risk_level: "low" | "medium" | "high";
  updated_at: string;
};

export type PatternAlertRecord = {
  type: string;
  label: string;
  count: number;
};

export type PatternMatrixCell = {
  severity_bucket: "low" | "medium" | "high";
  risk_level: "low" | "medium" | "high" | "unknown";
  count: number;
};

export type PatternConversionRecord = {
  accused_employee_hash: string;
  total_complaints: number;
  complaints_with_verdict: number;
  guilty_verdicts: number;
  guilty_rate: number | null;
};

export type PatternWatchlistRecord = {
  id: string;
  complaint_code: string;
  accused_employee_hash: string;
  severity_score: number;
  status: ComplaintRecord["status"];
  created_at: string;
  risk_level: "low" | "medium" | "high";
  total_complaints: number;
  guilty_count: number;
};

export type PatternInsightsRecord = {
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
  };
  status_funnel: {
    submitted: number;
    under_review: number;
    resolved: number;
    rejected: number;
  };
  severity_risk_matrix: PatternMatrixCell[];
  accused_conversion: PatternConversionRecord[];
  median_verdict_hours: number | null;
  watchlist: PatternWatchlistRecord[];
  alerts: PatternAlertRecord[];
};

export type HrDashboardOverviewRecord = {
  total_today: number;
  total_yesterday: number;
  total_month: number;
  under_hr_review: number;
  under_committee_review: number;
  active_cases: number;
  closed_cases: number;
  high_risk_cases: number;
  stale_cases: number;
  status_funnel: {
    submitted: number;
    under_review: number;
    resolved: number;
    rejected: number;
  };
  weekly_trend: number[];
  pattern_profile_count: number;
  alerts: PatternAlertRecord[];
};

export type HrDepartmentRiskRecord = {
  name: string;
  high: number;
  medium: number;
  low: number;
  total: number;
};

export type ComplaintAuditLogRecord = {
  id: string;
  complaint_id: string;
  complaint_code: string;
  hr_id: string;
  hr_name: string;
  action_type:
    | "CASE_ACCEPTED"
    | "DETAILS_VIEWED"
    | "STATUS_UPDATED"
    | "DECISION_SUBMITTED"
    | "VOTE_VIEWED"
    | "VOTE_CAST"
    | string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
};

export type PaginationResult = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type ComplaintAuditLogFilters = {
  action_types: string[];
  hr_users: Array<{ id: string; name: string }>;
};

export type PatternDetectionOverview = {
  escalation_index: {
    current_count: number;
    previous_count: number;
    percentage_change: number;
    trend: "increasing" | "decreasing" | "stable";
  };
  high_risk_accused_count: number;
  targeting_alerts_count: number;
  low_evidence_percentage: number;
  low_evidence_trend: {
    current_ratio: number;
    previous_ratio: number;
    percentage_change: number;
    trend: "increasing" | "decreasing" | "stable";
  };
  avg_resolution_time_hours: number;
  active_under_review: number;
};

export type RepeatOffenderRecord = {
  accused_employee_hash: string;
  total_complaints: number;
  guilty_count: number;
  risk_level: "low" | "medium" | "high";
  recurrence_interval: number | null;
};

export type TargetingAlertRecord = {
  accused_employee_hash: string;
  complaint_count: number;
  avg_credibility: number;
  alert_level: "medium" | "high";
};

export type DepartmentRiskRecord = {
  department: string;
  risk_score: number;
  previous_risk_score: number | null;
  risk_change_percentage: number;
  escalation_flag: boolean;
  last_updated: string;
};

export type PatternTimeTrendRecord = {
  week_start: string;
  complaints_count: number;
  avg_severity_score: number;
  guilty_verdict_rate: number;
};

export type SuspiciousComplainantRecord = {
  anon_user_id: string;
  credibility_score: number;
  total_complaints: number;
  rejected_ratio: number;
  credibility_trend: Array<{
    credibility_score: number;
    created_at: string;
  }>;
};

export type RiskAccelerationRecord = {
  accused_employee_hash: string;
  recent_complaint_count: number;
  time_window_days: number;
};

export type SuspiciousClusterRecord = {
  id: string;
  accused_employee_hash: string;
  cluster_suspicion_score: number;
  diversity_index: number;
  complaint_ids: string[];
  unique_device_count: number;
  similarity_cluster_count: number;
  review_status: "pending" | "reviewed" | "dismissed";
  created_at: string;
  updated_at: string;
};

export type AccusedComplaintRecord = {
  id: string;
  complaint_code: string;
  status: "submitted" | "under_review" | "resolved" | "rejected";
  severity_score: number;
  incident_date: string | null;
  created_at: string;
  updated_at: string;
  evidence_count: number;
  verdict: "guilty" | "not_guilty" | "insufficient_evidence" | null;
  decided_at: string | null;
};

export type PatternInsightMessage = {
  severity: "low" | "medium" | "high";
  message: string;
};

export type AccusedBreakdownRecord = {
  accused_employee_hash: string;
  status_breakdown: {
    submitted: number;
    under_review: number;
    resolved: number;
    rejected: number;
  };
  weekly_timeline: Array<{
    week_start: string;
    complaint_count: number;
    avg_severity: number;
  }>;
  no_evidence_ratio: number;
};

export type ChatThreadSummary = {
  thread_id: string;
  complaint_id: string;
  complaint_code: string;
  complaint_status: "submitted" | "under_review" | "resolved" | "rejected";
  chat_state: "not_requested" | "pending_acceptance" | "active";
  request_message: string | null;
  requested_at: string | null;
  accepted_at: string | null;
  seen?: {
    user_last_seen_message_id: string | null;
    hr_last_seen_message_id: string | null;
  };
  last_message_preview: string | null;
  last_message_at: string | null;
};

export type ChatMessageRecord = {
  id: string;
  sender_type: "user" | "hr";
  message: string;
  created_at: string;
};

export type ChatThreadDetails = {
  complaint_id: string;
  complaint_code: string;
  complaint_status: "submitted" | "under_review" | "resolved" | "rejected";
  chat_state: "not_requested" | "pending_acceptance" | "active";
  request_message: string | null;
  requested_at: string | null;
  accepted_at: string | null;
  seen?: {
    user_last_seen_message_id: string | null;
    hr_last_seen_message_id: string | null;
  };
};

type CreateComplaintPayload = {
  accused_employee_hash: string;
  description: string;
  incident_date?: string;
  location?: string;
  evidence_count?: number;
  has_witness?: boolean;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:5000/api/v1";

function toNetworkErrorMessage(err: unknown) {
  const base = `Unable to reach API at ${API_BASE_URL}. Check backend server, API URL, and CORS origin.`;
  const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
  return `${base}${detail}`;
}

async function safeFetch(input: string, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (err) {
    throw new ApiRequestError(toNetworkErrorMessage(err), 0);
  }
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = Cookies.get("accessToken");

  const headers = new Headers(init?.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const isFormDataBody = init?.body instanceof FormData;
  if (!headers.has("Content-Type") && !isFormDataBody) {
    headers.set("Content-Type", "application/json");
  }

  const response = await safeFetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  // Handle 401 Unauthorized - attempt to refresh token
  if (response.status === 401 && path !== "/auth/login" && path !== "/auth/refresh") {
    const refreshToken = Cookies.get("refreshToken");
    if (refreshToken) {
      try {
        const refreshResponse = await safeFetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        const refreshData = await safeJson<{ success?: boolean; data?: { tokens?: { accessToken?: string } } }>(refreshResponse);
        if (refreshResponse.ok && refreshData?.success && refreshData.data?.tokens?.accessToken) {
          const newAccessToken = refreshData.data.tokens.accessToken;
          Cookies.set("accessToken", newAccessToken, { expires: 7 });

          // Retry the original request
          headers.set("Authorization", `Bearer ${newAccessToken}`);
          const retryResponse = await safeFetch(`${API_BASE_URL}${path}`, {
            ...init,
            headers,
            cache: "no-store",
          });
          const retryData = (await safeJson<T & {
            success?: boolean;
            message?: string;
            details?: unknown;
          }>(retryResponse)) || ({} as T & { success?: boolean; message?: string; details?: unknown });

          if (!retryResponse.ok || !retryData.success) {
            throw new ApiRequestError(
              retryData.message || "Request failed.",
              retryResponse.status,
              retryData.details
            );
          }

          return retryData as T;
        }
      } catch (e) {
        console.error("Token refresh failed", e);
      }
    }

    // If refresh fails or no refresh token, logout (handled by AuthContext or middleware)
    // For now just throw error
  }

  const data = ((await safeJson<T & {
    success?: boolean;
    message?: string;
    details?: unknown;
  }>(response)) || ({} as T & { success?: boolean; message?: string; details?: unknown }));

  if (!response.ok || !data.success) {
    throw new ApiRequestError(data.message || "Request failed.", response.status, data.details);
  }

  return data as T;
}

export async function registerAnonUser(payload: RegisterPayload) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginAnonUser(payload: LoginPayload) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginHrUser(payload: HrLoginPayload) {
  return request<AuthResponse>("/auth/hr/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyHrOtp(payload: { challengeId: string; otp: string }) {
  return request<AuthResponse>("/auth/hr/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAliasSuggestions() {
  const result = await request<{ success: boolean; aliases: string[] }>("/auth/alias-suggestions");
  return result.aliases;
}

export async function fetchRecoveryPhrase() {
  const result = await request<{ success: boolean; phrase: string }>("/auth/recovery-phrase");
  return result.phrase;
}

type SupportHistoryItem = {
  role: "user" | "bot";
  content: string;
};

export async function sendSupportChatMessage(
  message: string,
  history?: SupportHistoryItem[]
) {
  return request<{
    success: boolean;
    data: {
      reply: string;
      source: string;
      citations: string[];
    };
  }>("/support-chat", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

export async function listMyComplaints() {
  const result = await request<{ success: boolean; data: ComplaintRecord[] }>("/complaints");
  return result.data;
}

export async function createComplaint(payload: CreateComplaintPayload) {
  const result = await request<{ success: boolean; data: ComplaintRecord }>("/complaints", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result.data;
}

export type EvidenceRecord = {
  id: string;
  complaint_id: string;
  file_url: string;
  signed_url?: string | null;
  file_hash_sha256: string;
  metadata: {
    originalName?: string;
    mimeType?: string;
    sizeBytes?: number;
    uploadedBy?: string;
    storageBucket?: string;
    storagePath?: string;
    notes?: string;
  } | null;
  uploaded_at: string;
};

export async function uploadEvidence(complaintReference: string, file: File, notes?: string) {
  const form = new FormData();
  form.append("file", file);
  if (notes?.trim()) {
    form.append("notes", notes.trim());
  }

  const result = await request<{ success: boolean; data: EvidenceRecord }>(
    `/evidence/${encodeURIComponent(complaintReference)}`,
    {
      method: "POST",
      body: form,
    }
  );

  return result.data;
}

export async function listEvidenceForComplaint(complaintReference: string) {
  const result = await request<{ success: boolean; data: EvidenceRecord[] }>(
    `/evidence/${encodeURIComponent(complaintReference)}`
  );
  return result.data;
}

export async function fetchMyProfile() {
  const result = await request<{ success: boolean; data: AuthUser }>("/auth/me");
  return result.data;
}

export async function changeAnonPassword(payload: {
  currentPassword: string;
  newPassword: string;
}) {
  return request<{ success: boolean; message?: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listChatThreads() {
  const result = await request<{ success: boolean; data: ChatThreadSummary[] }>("/chat/threads");
  return result.data;
}

export async function getChatMessages(complaintReference: string) {
  const result = await request<{
    success: boolean;
    data: {
      thread: ChatThreadDetails;
      messages: ChatMessageRecord[];
    };
  }>(`/chat/${encodeURIComponent(complaintReference)}/messages`);

  return result.data;
}

export async function sendChatMessage(complaintReference: string, message: string) {
  const result = await request<{ success: boolean; data: ChatMessageRecord }>(
    `/chat/${encodeURIComponent(complaintReference)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    }
  );
  return result.data;
}

export async function acceptChatRequest(complaintReference: string) {
  return request<{ success: boolean; data: { complaint_code: string; chat_state: string } }>(
    `/chat/${encodeURIComponent(complaintReference)}/accept`,
    {
      method: "POST",
    }
  );
}

export async function initiateChatRequest(complaintReference: string, message: string) {
  return request<{ success: boolean; data: { complaint_code: string; chat_state: string } }>(
    `/chat/${encodeURIComponent(complaintReference)}/request`,
    {
      method: "POST",
      body: JSON.stringify({ message }),
    }
  );
}

export async function fetchHrQueue() {
  const result = await request<{ success: boolean; data: HrQueueRecord[] }>("/hr/queue");
  return result.data;
}

export async function fetchHrHistory() {
  const result = await request<{ success: boolean; data: HrQueueRecord[] }>("/hr/history");
  return result.data;
}

export async function fetchHrComplaintAuditLogs(params?: {
  page?: number;
  limit?: number;
  search?: string;
  actionType?: string;
  hrId?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search && params.search.trim().length > 0) query.set("search", params.search.trim());
  if (params?.actionType && params.actionType.trim().length > 0) query.set("action_type", params.actionType.trim());
  if (params?.hrId && params.hrId.trim().length > 0) query.set("hr_id", params.hrId.trim());
  const suffix = query.toString().length > 0 ? `?${query.toString()}` : "";

  return request<{
    success: boolean;
    data: ComplaintAuditLogRecord[];
    pagination: PaginationResult;
    filters: ComplaintAuditLogFilters;
  }>(
    `/hr/logs${suffix}`
  );
}

export async function acceptHrCase(complaintReference: string) {
  const result = await request<{
    success: boolean;
    data: {
      complaint_code: string;
      workflow_status: CaseWorkflowStatus;
      assigned_hr_id: string;
    };
  }>(`/hr/cases/${encodeURIComponent(complaintReference)}/accept`, {
    method: "POST",
  });
  return result.data;
}

export async function fetchHrCaseDetail(complaintReference: string) {
  const result = await request<{ success: boolean; data: HrComplaintRecord & { workflow_status?: CaseWorkflowStatus } }>(
    `/hr/cases/${encodeURIComponent(complaintReference)}`
  );
  return result.data;
}

export async function submitHrCaseDecision(
  complaintReference: string,
  payload: { notes?: string }
) {
  const result = await request<{
    success: boolean;
    data: {
      complaint_code: string;
      workflow_status: CaseWorkflowStatus;
      status: ComplaintRecord["status"];
    };
  }>(`/hr/cases/${encodeURIComponent(complaintReference)}/decision`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result.data;
}

export async function fetchHrNotifications() {
  const result = await request<{ success: boolean; data: HrNotificationRecord[] }>("/hr/notifications");
  return result.data;
}

export async function fetchHrNotificationDetail(complaintReference: string) {
  const result = await request<{ success: boolean; data: HrNotificationDetail }>(
    `/hr/notifications/${encodeURIComponent(complaintReference)}`
  );
  return result.data;
}

export async function listEvidenceForNotificationReview(complaintReference: string) {
  const result = await request<{ success: boolean; data: EvidenceRecord[] }>(
    `/hr/notifications/${encodeURIComponent(complaintReference)}/evidence`
  );
  return result.data;
}

export async function castNotificationVote(
  complaintReference: string,
  vote: "support" | "oppose"
) {
  const result = await request<{
    success: boolean;
    data: {
      complaint_code: string;
      vote_tally: {
        eligible_count: number;
        support_count: number;
        oppose_count: number;
        threshold: number;
      };
      finalized: {
        workflow_status: CaseWorkflowStatus;
        status: ComplaintRecord["status"];
      } | null;
    };
  }>(`/hr/notifications/${encodeURIComponent(complaintReference)}/vote`, {
    method: "POST",
    body: JSON.stringify({ vote }),
  });
  return result.data;
}

export async function fetchAccusedPatterns() {
  const result = await request<{ success: boolean; data: AccusedPatternRecord[] }>(
    "/hr/accused-patterns"
  );
  return result.data;
}

export async function fetchPatternInsights() {
  const result = await request<{ success: boolean; data: PatternInsightsRecord }>(
    "/hr/pattern-insights"
  );
  return result.data;
}

export async function fetchHrDashboardOverview() {
  const result = await request<{ success: boolean; data: HrDashboardOverviewRecord }>(
    "/hr/dashboard-overview"
  );
  return result.data;
}

export async function fetchHrDashboardDepartmentRisk() {
  const result = await request<{ success: boolean; data: HrDepartmentRiskRecord[] }>(
    "/hr/dashboard-department-risk"
  );
  return result.data;
}

export async function fetchPatternDetectionOverview() {
  const result = await request<{ success: boolean; data: PatternDetectionOverview }>(
    "/hr/pattern-detection/overview"
  );
  return result.data;
}

export async function fetchPatternDetectionRepeatOffenders() {
  const result = await request<{ success: boolean; data: RepeatOffenderRecord[] }>(
    "/hr/pattern-detection/repeat-offenders"
  );
  return result.data;
}

export async function fetchPatternDetectionTargetingAlerts() {
  const result = await request<{ success: boolean; data: TargetingAlertRecord[] }>(
    "/hr/pattern-detection/targeting-alerts"
  );
  return result.data;
}

export async function fetchPatternDetectionDepartmentRisk() {
  const result = await request<{ success: boolean; data: DepartmentRiskRecord[] }>(
    "/hr/pattern-detection/department-risk"
  );
  return result.data;
}

export async function fetchPatternDetectionTimeTrends() {
  const result = await request<{ success: boolean; data: PatternTimeTrendRecord[] }>(
    "/hr/pattern-detection/time-trends"
  );
  return result.data;
}

export async function fetchPatternDetectionCredibilityRisk() {
  const result = await request<{ success: boolean; data: SuspiciousComplainantRecord[] }>(
    "/hr/pattern-detection/credibility-risk"
  );
  return result.data;
}

export async function fetchPatternDetectionInsights() {
  const result = await request<{ success: boolean; data: PatternInsightMessage[] }>(
    "/hr/pattern-detection/insights"
  );
  return result.data;
}

export async function fetchPatternDetectionRiskAcceleration() {
  const result = await request<{ success: boolean; data: RiskAccelerationRecord[] }>(
    "/hr/pattern-detection/risk-acceleration"
  );
  return result.data;
}

export async function fetchPatternDetectionSuspiciousClusters() {
  const result = await request<{ success: boolean; data: SuspiciousClusterRecord[] }>(
    "/hr/pattern-detection/suspicious-clusters"
  );
  return result.data;
}

export async function fetchPatternDetectionAccusedBreakdown(accusedHash: string) {
  const result = await request<{ success: boolean; data: AccusedBreakdownRecord }>(
    `/hr/pattern-detection/accused/${encodeURIComponent(accusedHash)}/breakdown`
  );
  return result.data;
}

export async function fetchPatternDetectionAccusedComplaints(accusedHash: string) {
  const result = await request<{ success: boolean; data: AccusedComplaintRecord[] }>(
    `/hr/pattern-detection/accused/${encodeURIComponent(accusedHash)}/complaints`
  );
  return result.data;
}

export async function updateHrComplaintStatus(
  complaintReference: string,
  status: ComplaintRecord["status"],
  rejectionType?: RejectionType | null
) {
  const payload: { status: ComplaintRecord["status"]; rejection_type?: RejectionType } = { status };
  if (typeof rejectionType === "string" && rejectionType.length > 0) {
    payload.rejection_type = rejectionType;
  }
  const result = await request<{ success: boolean; data: HrComplaintRecord }>(
    `/complaints/${encodeURIComponent(complaintReference)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}

export async function fetchVerdict(complaintReference: string) {
  const result = await request<{ success: boolean; data: VerdictRecord }>(
    `/hr/verdict/${encodeURIComponent(complaintReference)}`
  );
  return result.data;
}

export async function saveVerdict(
  complaintReference: string,
  payload: { verdict: VerdictRecord["verdict"]; notes?: string }
) {
  const result = await request<{ success: boolean; data: VerdictRecord }>(
    `/hr/verdict/${encodeURIComponent(complaintReference)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
  return result.data;
}
