const mongoose = require("mongoose");

const noiseReportSchema = new mongoose.Schema({
  // 👤 User who submitted the report
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  // 🎥 Audio/Video upload
  mediaUrl: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    enum: ["audio", "video"],
    required: true
  },

  // 📄 Text details
  reason: {
    type: String,
    required: true
  },
  comment: {
    type: String,
    default: ""
  },

  // 📍 Regular location object
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: Object } // e.g. reverse geocoding API result
  },

  // 🗺️ GeoJSON format (used for maps & aggregation)
  geoLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      index: "2dsphere"
    }
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Geo index for map clustering
noiseReportSchema.index({ geoLocation: "2dsphere" });

module.exports = mongoose.model("NoiseReport", noiseReportSchema);
