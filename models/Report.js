const mongoose = require("mongoose");

const noiseReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  mediaUrl: { type: String, required: true },
  mediaType: {
    type: String,
    enum: ["audio", "video"],
    required: true
  },

  reason: { type: String, required: true },
  comment: { type: String, default: "" },

  location: {
    latitude: Number,
    longitude: Number,
    address: mongoose.Schema.Types.Mixed
  },

  geoLocation: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v) => v.length === 2,
        message: "Coordinates must be [longitude, latitude]"
      }
    }
  },

  noiseLevel: {
    type: String,
    enum: ["red", "yellow", "green"],
    required: true
  },

  consecutiveDays: { type: Number, default: 1 },

  status: {
    type: String,
    enum: ["pending","monitoring", "action_required", "resolved"],
    default: "pending"
  },

  adminActions: [
    {
      action: {
        type: String,
        enum: ["Confirmed", "Officer Assigned", "Warning Issued", "Completed"],
        required: false
      },
      note: { type: String, default: "" },
      timestamp: { type: Date, default: Date.now }
    }
  ],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-update timestamp
noiseReportSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
noiseReportSchema.index({ geoLocation: "2dsphere" });
noiseReportSchema.index({ status: 1 });
noiseReportSchema.index({ userId: 1 });
noiseReportSchema.index({ noiseLevel: 1 });

module.exports = mongoose.model("NoiseReport", noiseReportSchema);
