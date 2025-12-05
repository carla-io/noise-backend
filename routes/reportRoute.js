const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const NoiseReport = require("../models/Report");

const router = express.Router();

// Cloudinary Config
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


// ===============================
// ✅ POST: Create New Noise Report
// ===============================
router.post("/new-report", upload.single("media"), async (req, res) => {
  try {
    const { userId, reason, comment, location, mediaType } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const mediaUrl = req.file?.path;
    if (!mediaUrl || !reason) {
      return res.status(400).json({ message: "Media and reason are required." });
    }

    const parsedLocation = location ? JSON.parse(location) : null;

    const newReport = new NoiseReport({
      userId,
      mediaUrl,
      mediaType,
      reason,
      comment,
      location: parsedLocation,
      geoLocation: parsedLocation
        ? {
            type: "Point",
            coordinates: [
              parsedLocation.longitude,
              parsedLocation.latitude
            ]
          }
        : null,
    });

    await newReport.save();

    res.status(201).json({
      message: "Noise report saved successfully!",
      report: newReport,
    });
  } catch (error) {
    console.error("Error saving report:", error);
    res.status(500).json({
      message: "Error saving report",
      error: error.message,
    });
  }
});


// ===============================
// ✅ GET: All Reports
// ===============================
router.get("/get-report", async (req, res) => {
  try {
    const reports = await NoiseReport.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ message: "Error fetching reports" });
  }
});


// ===============================
// ✅ GET: Map Data
// ===============================
router.get("/map-data", async (req, res) => {
  try {
    const result = await NoiseReport.aggregate([
      {
        $match: {
          "location.latitude": { $type: "number" },
          "location.longitude": { $type: "number" }
        }
      },
      {
        $group: {
          _id: {
            lat: "$location.latitude",
            lon: "$location.longitude"
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          coordinates: ["$_id.lon", "$_id.lat"],
          count: 1
        }
      }
    ]);

    res.json(result);
  } catch (err) {
    console.error("Map error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ===============================
// ⭐ SINGLE USER — Fetch Own Reports
// ===============================
router.get("/get-user-report/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const reports = await NoiseReport.find({ userId }).sort({ createdAt: -1 });

    res.json({
      message: "User reports fetched.",
      count: reports.length,
      reports,
    });
  } catch (err) {
    console.error("Error fetching user reports:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// EXPORT ROUTER
module.exports = router;
