const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer with Cloudinary storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'user-profiles',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }]
    }
});

const upload = multer({ storage });

const transporter = nodemailer.createTransport({
    service: 'gmail', // Or use SMTP configuration
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

// Register with optional profile photo
// router.post('/register', upload.single('profilePhoto'), async (req, res) => {
//     try {
//         const { name, email, password, userType, licenseNumber } = req.body;

//         // Check if user already exists
//         const existingUser = await User.findOne({ email });
//         if (existingUser) {
//             return res.status(400).json({ message: 'User already exists' });
//         }

//         // Vet: Check if license number is required and already used
//         // if (userType === 'vet') {
//         //     if (!licenseNumber || !/^[0-9]{6,7}$/.test(licenseNumber)) {
//         //         return res.status(400).json({ message: 'Invalid or missing license number' });
//         //     }

//         //     const existingLicense = await User.findOne({ licenseNumber });
//         //     if (existingLicense) {
//         //         return res.status(400).json({ message: 'License number already registered' });
//         //     }
//         // }

//         // Hash password
//         const hashedPassword = await bcrypt.hash(password, 10);

//         // Create user object
//         const userData = {
//             name,
//             email,
//             password: hashedPassword,
//             userType,
//         };

//         // Add license if vet
//         // if (userType === 'vet') {
//         //     userData.licenseNumber = licenseNumber;
//         // }

//         // Add profile photo if exists
//         if (req.file) {
//             userData.profilePhoto = req.file.path;
//         }

//         const user = await User.create(userData);

//         // Create token
//         const token = jwt.sign(
//             { id: user._id, userType: user.userType },
//             process.env.JWT_SECRET,
//             { expiresIn: '1d' }
//         );

//         res.status(201).json({
//             user: {
//                 id: user._id,
//                 name: user.name,
//                 email: user.email,
//                 userType: user.userType,
//                 // licenseNumber: user.licenseNumber,
//                 profilePhoto: user.profilePhoto,
//             },
//             token
//         });

//     } catch (error) {
//         console.error('Registration error:', error);
//         res.status(500).json({ message: error.message });
//     }
// });


router.post('/register', upload.single('profilePhoto'), async (req, res) => {
    try {
        const { username, email, password, userType } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const userData = {
            username,
            email,
            password: hashedPassword,
            userType,
            isVerified: false // ✅ add this
        };

        if (req.file) {
            userData.profilePhoto = req.file.path;
        }

        const user = await User.create(userData);

        // Create email verification token
        const verificationToken = jwt.sign(
            { email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        const verificationLink = `http://localhost:5000/auth/verify-email?token=${verificationToken}`;


        // Send verification email
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: user.email,
            subject: 'Verify Your Email',
            text: `Hi ${user.username}, please verify your email by clicking this link: ${verificationLink}`
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) console.error('Email send error:', error);
        });

        res.status(201).json({
            message: 'Registration successful! Please check your email to verify.',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                userType: user.userType,
                profilePhoto: user.profilePhoto
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/verify-email', async (req, res) => {
    try {
        const token = req.query.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findOne({ email: decoded.email });
        if (!user) {
            return res.status(400).send(`
                <html>
                  <head>
                    <title>Email Verification</title>
                    <style>
                      body { font-family: Arial, sans-serif; text-align:center; background:#f9fafb; color:#333; }
                      .container { margin: 100px auto; max-width: 500px; padding: 40px; background:#fff; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                      h1 { color: #16a34a; }
                      a { display:inline-block; margin-top:20px; padding:10px 20px; background:#16a34a; color:#fff; text-decoration:none; border-radius:8px; }
                      a:hover { background:#15803d; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <h1>Invalid or expired link</h1>
                      <p>Please register again or request a new verification email.</p>
                    </div>
                  </body>
                </html>
            `);
        }

        // If already verified
        if (user.isVerified) {
            return res.status(200).send(`
                <html>
                  <head>...same styles...</head>
                  <body>
                    <div class="container">
                      <h1>Your email is already verified</h1>
                      <p>You can now log in to your account.</p>
                    </div>
                  </body>
                </html>
            `);
        }

        user.isVerified = true;
        await user.save();

        // Success page
        res.status(200).send(`
            <html>
              <head>
                <title>Email Verified</title>
                <style>
                  body { font-family: Arial, sans-serif; text-align:center; background:#f9fafb; color:#333; }
                  .container { margin: 100px auto; max-width: 500px; padding: 40px; background:#fff; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                  h1 { color: #16a34a; }
                  p { font-size: 18px; }
                  a { display:inline-block; margin-top:20px; padding:10px 20px; background:#16a34a; color:#fff; text-decoration:none; border-radius:8px; }
                  a:hover { background:#15803d; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>Email Verified Successfully!</h1>
                  <p>Hi ${user.username}, your email has been verified. You can now log in to your account.</p>
                  
                </div>
              </body>
            </html>
        `);

    } catch (err) {
        console.error(err);
        res.status(400).send('<h2>Invalid or expired verification link.</h2>');
    }
});



router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Email and password are required' 
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }

        // ✅ Check if email is verified
        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email before logging in.'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }

        const token = jwt.sign(
            { id: user._id, userType: user.userType },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                _id: user._id,
                username: user.username,
                email: user.email,
                userType: user.userType,
                profilePhoto: user.profilePhoto
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
});


// router.post('/login', async (req, res) => {
//     try {
//         const { email, password } = req.body;

//         // Validate request body
//         if (!email || !password) {
//             return res.status(400).json({ 
//                 success: false,
//                 message: 'Email and password are required' 
//             });
//         }

//         const user = await User.findOne({ email });
//         if (!user) {
//             return res.status(400).json({ 
//                 success: false,
//                 message: 'Invalid credentials' 
//             });
//         }

//         const isPasswordValid = await bcrypt.compare(password, user.password);
//         if (!isPasswordValid) {
//             return res.status(400).json({ 
//                 success: false,
//                 message: 'Invalid credentials' 
//             });
//         }

//         const token = jwt.sign(
//             { id: user._id, userType: user.userType },
//             process.env.JWT_SECRET,
//             { expiresIn: '1d' }
//         );

//         res.status(200).json({
//             success: true,
//             token,
//             user: {
//                 id: user._id,
//                 _id: user._id,
//                 username: user.username,
//                 email: user.email,
//                 userType: user.userType,
//                 profilePhoto: user.profilePhoto
//             }
//         });

//     } catch (error) {
//         console.error('Login error:', error);
//         res.status(500).json({ 
//             success: false,
//             message: 'Internal server error' 
//         });
//     }
// });



module.exports = router;