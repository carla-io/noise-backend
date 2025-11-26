const mongoose = require("mongoose");

const noiseReportSchema = new mongoose.Schema({
  mediaUrl: { type: String, required: true },
  mediaType: { type: String, enum: ["audio", "video"], required: true },
  reason: { type: String, required: true },
  comment: { type: String },

  // Original storage (you already use this)
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: Object },
  },

  // ✅ GeoJSON field for maps and aggregation
  geoLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [long, lat]
      index: "2dsphere",
    }
  },

  createdAt: { type: Date, default: Date.now },
});

noiseReportSchema.index({ geoLocation: "2dsphere" });

module.exports = mongoose.model("NoiseReport", noiseReportSchema);
