const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'user-profiles',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }]
    }
});

const upload = multer({ storage });

// GET /user/profile - Get authenticated user's profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Construct the user profile response
    const userProfile = {
      id: user._id,
      username: user.username,
      email: user.email,
      userType: user.userType,
      profilePhoto: user.profilePhoto,
    };

   

    return res.status(200).json({
      success: true,
      user: userProfile
    });

  } catch (error) {
    console.error('Profile Fetch Error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching profile'
    });
  }
});

// router.put('/update', authenticate, upload.single('profilePhoto'), async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const { username, email } = req.body;
//     let updateFields = {};

//     if (username) updateFields.username = username;
//     if (email) updateFields.email = email;

//     // If photo uploaded, store its Cloudinary URL
//     if (req.file && req.file.path) {
//       updateFields.profilePhoto = req.file.path; // Cloudinary returns secure URL in `path`
//     }

//     if (Object.keys(updateFields).length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No fields provided to update',
//       });
//     }

//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       { $set: updateFields },
//       { new: true, runValidators: true, select: '-password' }
//     );

//     if (!updatedUser) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found',
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: 'Profile updated successfully',
//       user: updatedUser,
//     });
//   } catch (error) {
//     console.error('Profile Update Error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Error updating profile',
//     });
//   }
// });

router.put('/update/:id', authenticate, upload.single('profilePhoto'), async (req, res) => {
  try {
    const { username, email, password, userType } = req.body;

    // Find user first
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields if provided
    if (username) user.username = username;
    if (email) user.email = email;
    if (userType) user.userType = userType;

    // Hash new password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    // Handle profile photo upload
    if (req.file && req.file.path) {
      // Optionally delete the old Cloudinary photo (if it's not the default)
      if (user.profilePhoto && !user.profilePhoto.includes('default_profile.png')) {
        const publicId = user.profilePhoto.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`profile_photos/${publicId}`);
      }
      user.profilePhoto = req.file.path;
    }

    await user.save();
    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ message: 'An error occurred while updating user', error: error.message });
  }
});





 router.get('/getAll', async (req, res) => {
        try {
            const users = await User.find({}, '-password'); // exclude password field
            res.status(200).json({ success: true, users });
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });



router.get('/countUsersOnly', async (req, res) => {
  try {
    const count = await User.countDocuments({ userType: 'user' });
    res.status(200).json({ success: true, count });
  } catch (error) {
    console.error('Error counting user-type users:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});



router.get('/getAllUsersOnly', async (req, res) => {
  try {
    const users = await User.find({ userType: 'user' }, '-password');
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Error fetching user-type users:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});






module.exports = router;