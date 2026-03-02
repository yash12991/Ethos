const complaintModel = require('../models/complaint.model');
const evidenceModel = require('../models/evidence.model');
const hashEvidence = require('../utils/hashEvidence');
const { encryptFields, decryptFields } = require('../services/encryption.service');
const { logAuditEvent } = require('../services/audit.service');
const { supabaseService } = require('../config/supabase');
const { canViewFullComplaint, isAssignedInvestigator } = require('../services/caseAccess.service');

const EVIDENCE_BUCKET = process.env.SUPABASE_EVIDENCE_BUCKET || 'evidence';
const EVIDENCE_SIGNED_URL_TTL_SECONDS = Number(process.env.EVIDENCE_SIGNED_URL_TTL_SECONDS || 600);

function toUserType(role) {
  return role === 'reporter' ? 'anon' : 'hr';
}

function sanitizeFilename(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function safelyDecryptNote(noteValue) {
  if (!noteValue) return '';

  try {
    const decrypted = decryptFields({ notes: String(noteValue) }, ['notes']);
    return decrypted.notes;
  } catch {
    // Backward compatibility for legacy/plain notes values.
    return String(noteValue);
  }
}

function parseSupabaseRef(fileUrl, metadata = {}) {
  if (metadata.storageBucket && metadata.storagePath) {
    return {
      bucket: String(metadata.storageBucket),
      path: String(metadata.storagePath),
    };
  }

  const match = String(fileUrl || '').match(/^supabase:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;

  return {
    bucket: match[1],
    path: match[2],
  };
}

async function uploadEvidence(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    if (!supabaseService) {
      return res.status(500).json({
        success: false,
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for evidence uploads',
      });
    }

    const { complaintId } = req.params;
    const complaint = await complaintModel.findByReference(complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    const isReporterOwner = req.user.role === 'reporter'
      && String(complaint.anon_user_id) === String(req.user.id);
    const isAssignedHr = isAssignedInvestigator(complaint, req.user.id);
    if (!isReporterOwner && !isAssignedHr) {
      return res.status(403).json({ success: false, message: 'You do not have access to upload evidence for this case' });
    }

    const sha256Hash = hashEvidence(req.file.buffer);
    const encryptedNotes = encryptFields({ notes: req.body.notes || '' }, ['notes']);
    const safeFileName = sanitizeFilename(req.file.originalname);
    const storagePath = `${complaint.complaint_code}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabaseService.storage
      .from(EVIDENCE_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file to Supabase Storage',
        error: uploadError.message,
      });
    }

    let evidence;
    try {
      evidence = await evidenceModel.createEvidence({
        complaint_id: complaint.id,
        file_url: `supabase://${EVIDENCE_BUCKET}/${storagePath}`,
        file_hash_sha256: sha256Hash,
        metadata: {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          uploadedBy: req.user.id,
          storageBucket: EVIDENCE_BUCKET,
          storagePath,
          notes: encryptedNotes.notes,
        },
      });
    } catch (dbErr) {
      await supabaseService.storage.from(EVIDENCE_BUCKET).remove([storagePath]);
      throw dbErr;
    }

    await logAuditEvent({
      actorUserId: req.user.id,
      action: 'evidence.upload',
      userType: toUserType(req.user.role),
      metadata: { complaintCode: complaint.complaint_code, sha256Hash, storagePath },
    });

    return res.status(201).json({ success: true, data: evidence });
  } catch (err) {
    return next(err);
  }
}

async function listEvidence(req, res, next) {
  try {
    const { complaintId } = req.params;
    const complaint = await complaintModel.findByReference(complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    const isReporterOwner = req.user.role === 'reporter'
      && String(complaint.anon_user_id) === String(req.user.id);
    const hrAllowed = canViewFullComplaint(complaint, req.user);
    if (!isReporterOwner && !hrAllowed) {
      return res.status(403).json({ success: false, message: 'You do not have access to evidence for this case' });
    }

    const records = await evidenceModel.listEvidenceForComplaint(complaintId);

    const normalized = await Promise.all(records.map(async (row) => {
      const metadata = row.metadata || {};
      let signedUrl = null;

      if (supabaseService) {
        const storageRef = parseSupabaseRef(row.file_url, metadata);
        if (storageRef) {
          const signed = await supabaseService.storage
            .from(storageRef.bucket)
            .createSignedUrl(storageRef.path, EVIDENCE_SIGNED_URL_TTL_SECONDS);
          if (!signed.error) {
            signedUrl = signed.data?.signedUrl || null;
          }
        }
      }

      return {
        ...row,
        metadata: {
          ...metadata,
          notes: safelyDecryptNote(metadata.notes),
        },
        signed_url: signedUrl,
      };
    }));

    return res.json({ success: true, data: normalized });
  } catch (err) {
    return next(err);
  }
}

async function listEvidenceForNotificationReview(req, res, next) {
  try {
    if (!['hr', 'committee', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only HR users can access notification evidence' });
    }

    const complaint = await complaintModel.findNotificationCase(req.params.complaintId, req.user.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Notification case not found or not available for voting' });
    }

    const records = await evidenceModel.listEvidenceForComplaint(req.params.complaintId);
    const normalized = await Promise.all(records.map(async (row) => {
      const metadata = row.metadata || {};
      let signedUrl = null;

      if (supabaseService) {
        const storageRef = parseSupabaseRef(row.file_url, metadata);
        if (storageRef) {
          const signed = await supabaseService.storage
            .from(storageRef.bucket)
            .createSignedUrl(storageRef.path, EVIDENCE_SIGNED_URL_TTL_SECONDS);
          if (!signed.error) {
            signedUrl = signed.data?.signedUrl || null;
          }
        }
      }

      return {
        ...row,
        metadata: {
          ...metadata,
          notes: safelyDecryptNote(metadata.notes),
        },
        signed_url: signedUrl,
      };
    }));

    return res.json({ success: true, data: normalized });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  uploadEvidence,
  listEvidence,
  listEvidenceForNotificationReview,
};
