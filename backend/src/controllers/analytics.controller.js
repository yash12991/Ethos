const complaintModel = require('../models/complaint.model');
const accusedModel = require('../models/accused.model');
const { detectPatterns } = require('../services/patternDetection.service');

async function summary(req, res, next) {
  try {
    const complaints = await complaintModel.listForHr();
    const accusedProfiles = await accusedModel.listAccusedPatterns();

    const statusBreakdown = complaints.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    const pattern = detectPatterns(complaints);

    return res.json({
      success: true,
      data: {
        totalComplaints: complaints.length,
        statusBreakdown,
        repeatedAccused: pattern.repeatedAccused,
        accusedProfiles,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  summary,
};
