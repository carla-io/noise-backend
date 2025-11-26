const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userType: { 
        type: String, 
        enum: ['admin', 'user'],
        default: 'user'
    },
    profilePhoto: { 
        type: String, 
        default: function() {
            return `${process.env.CLOUDINARY_BASE_URL}/default_profile.png`;
        }
    },
     isVerified: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
