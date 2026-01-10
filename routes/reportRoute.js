const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const NoiseReport = require("../models/Report");

const router = express.Router();

// ------------------------------
// Cloudinary Config
// ------------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "noise_reports",
    resource_type: "auto",
    public_id: `${Date.now()}-${file.originalname}`,
  }),
});

const upload = multer({ storage });

// ------------------------------
// Helper: Admin Auto-Response Text
// ------------------------------
const generateAdminResponse = (noiseLevel, consecutiveDays, status) => {
  if (noiseLevel === "red") {
    if (status === "resolved")
      return "Your noise complaint has been resolved. Appropriate action has been taken by the barangay.";
    if (consecutiveDays >= 3)
      return "The noise has been reported for 3 consecutive days. A barangay officer has been assigned to take action.";
    return `Report received. Monitoring ongoing. Day ${consecutiveDays} of 3 for RED noise.`;
  }

  if (noiseLevel === "yellow") {
    if (status === "resolved")
      return "Your noise complaint has been resolved. The barangay has addressed the issue.";
    if (consecutiveDays >= 5)
      return "Noise reported for 5 days. A barangay officer will take action.";
    return `Report logged. Monitoring continues. Day ${consecutiveDays} of 5 for YELLOW noise.`;
  }

  if (noiseLevel === "green") {
    if (status === "resolved")
      return "Advice has been provided. This report is now resolved.";
    return "Minor noise disturbance recorded. Barangay suggests communication with neighbors.";
  }

  return "";
};

// =======================================================================
// ✅ POST: CREATE NEW NOISE REPORT
// =======================================================================
router.post("/new-report", upload.single("media"), async (req, res) => {
  try {
    const { userId, reason, comment, mediaType, noiseLevel } = req.body;

    if (!userId) return res.status(400).json({ message: "User ID is required." });
    if (!reason) return res.status(400).json({ message: "Reason is required." });
    if (!req.file) return res.status(400).json({ message: "Media is required." });

    // Validate noise level
    if (!["red", "yellow", "green"].includes(noiseLevel)) {
      return res.status(400).json({ message: "Invalid noise level." });
    }

    // Parse location safely
    let parsedLocation = null;
    if (req.body.location) {
      try {
        parsedLocation = JSON.parse(req.body.location);
      } catch {
        return res.status(400).json({ message: "Invalid location format." });
      }
    }

    // ❗❗ IMPORTANT CHANGE:
    // No more auto consecutive-day logic.
    // No more auto status change.
    // Every new report = status: "pending"

    const newReport = new NoiseReport({
      userId,
      mediaUrl: req.file.path,
      mediaType,
      reason,
      comment,
      location: parsedLocation,
      geoLocation: parsedLocation
        ? {
            type: "Point",
            coordinates: [parsedLocation.longitude, parsedLocation.latitude],
          }
        : undefined,
      noiseLevel,
      
      // Default status
      status: "pending",

      // No admin actions until admin responds
      adminActions: [],
    });

    await newReport.save();

    res.status(201).json({
      message: "Noise report submitted and awaiting admin review.",
      report: newReport,
    });

  } catch (error) {
    console.error("❌ Error saving report:", error);
    res.status(500).json({ message: "Error saving report", error: error.message });
  }
});


// =======================================================================
// ✅ GET: ALL REPORTS
// =======================================================================
router.get("/get-report", async (req, res) => {
  try {
    const reports = await NoiseReport.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error("❌ Error fetching reports:", error);
    res.status(500).json({ message: "Error fetching reports" });
  }
});

// =======================================================================
// ✅ GET: MAP DATA (CLUSTERING)
// =======================================================================
router.get("/map-data", async (req, res) => {
  try {
    const result = await NoiseReport.aggregate([
      {
        $match: {
          "geoLocation.coordinates": { $exists: true },
        },
      },
      {
        $group: {
          _id: {
            lng: { $arrayElemAt: ["$geoLocation.coordinates", 0] },
            lat: { $arrayElemAt: ["$geoLocation.coordinates", 1] },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          coordinates: ["$_id.lng", "$_id.lat"],
          count: 1,
        },
      },
    ]);

    res.json(result);
  } catch (err) {
    console.error("❌ Map data error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =======================================================================
// ⭐ GET: SINGLE USER — FETCH OWN REPORTS
// =======================================================================
router.get("/get-user-report/:userId", async (req, res) => {
  try {
    const reports = await NoiseReport.find({ userId: req.params.userId }).sort({
      createdAt: -1,
    });

    res.json({
      message: "User reports fetched.",
      count: reports.length,
      reports,
    });
  } catch (err) {
    console.error("❌ Error fetching user reports:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.put("/update-status/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;

    if (!["monitoring", "action_required", "resolved"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const updatedReport = await NoiseReport.findByIdAndUpdate(
      reportId,
      { 
        status,
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!updatedReport) {
      return res.status(404).json({ message: "Report not found." });
    }

    res.status(200).json({
      message: "Status updated successfully",
      report: updatedReport,
    });
  } catch (error) {
    console.error("❌ Error updating status:", error);
    res.status(500).json({ message: "Error updating status", error: error.message });
  }
});


router.get("/total-reports", async (req, res) => {
  try {
    const total = await NoiseReport.countDocuments();
    res.json({ totalReports: total });
  } catch (error) {
    console.error("❌ Error counting reports:", error);
    res.status(500).json({ message: "Error counting reports" });
  }
});

module.exports = router;
