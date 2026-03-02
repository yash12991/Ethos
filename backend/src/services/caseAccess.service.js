function isHrRole(role) {
  return ['hr', 'committee', 'admin'].includes(role);
}

function resolveWorkflowStatus(complaint) {
  if (!complaint) return 'open';

  const raw = complaint.workflow_status || complaint.workflow_status_resolved;
  if (raw) return String(raw);

  if (complaint.status === 'under_review') return 'under_review';
  if (complaint.status === 'resolved') return 'resolved';
  if (complaint.status === 'rejected') return 'rejected';
  if (complaint.assigned_hr_id) return 'in_progress';
  return 'open';
}

function isAssignedInvestigator(complaint, userId) {
  if (!complaint?.assigned_hr_id || !userId) return false;
  return String(complaint.assigned_hr_id) === String(userId);
}

function canViewFullComplaint(complaint, user) {
  if (!user || !complaint) return false;

  if (user.role === 'reporter') {
    return String(complaint.anon_user_id) === String(user.id);
  }

  if (!isHrRole(user.role)) return false;
  return isAssignedInvestigator(complaint, user.id);
}

function canAccessChat(complaint, user) {
  if (!user || !complaint) return false;
  if (user.role === 'reporter') return String(complaint.anon_user_id) === String(user.id);
  return isHrRole(user.role) && isAssignedInvestigator(complaint, user.id);
}

function canSubmitInvestigatorDecision(complaint, user) {
  if (!user || !complaint) return false;
  return isHrRole(user.role)
    && isAssignedInvestigator(complaint, user.id)
    && resolveWorkflowStatus(complaint) === 'in_progress';
}

function canVoteOnCase(complaint, user) {
  if (!user || !complaint || !isHrRole(user.role)) return false;
  return !isAssignedInvestigator(complaint, user.id)
    && resolveWorkflowStatus(complaint) === 'under_review';
}

module.exports = {
  isHrRole,
  resolveWorkflowStatus,
  isAssignedInvestigator,
  canViewFullComplaint,
  canAccessChat,
  canSubmitInvestigatorDecision,
  canVoteOnCase,
};
