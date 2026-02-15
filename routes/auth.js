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

// Configure NodeMailer with Gmail SMTP
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS // 16-char App Password
    }
});

// ========== REGISTER ========== //
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
            isVerified: false
        };

        if (req.file) userData.profilePhoto = req.file.path;

        const user = await User.create(userData);

        // Create verification token
        const verificationToken = jwt.sign(
            { email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Use deployed backend URL
        const verificationLink = `http://localhost:5000/auth/verify-email?token=${verificationToken}`;

        // Send verification email via Gmail SMTP
        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: user.email,
            subject: 'Verify Your Email',
            html: `
                <h2>Hello ${user.username},</h2>
                <p>Please click the link below to verify your email:</p>
                <a href="${verificationLink}" style="padding:10px 20px; background:#4CAF50; color:white; text-decoration:none; border-radius:5px;">
                    Verify Email
                </a>
                <p>This link will expire in 24 hours.</p>
            `
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

// ========== VERIFY EMAIL ========== //
router.get('/verify-email', async (req, res) => {
    try {
        const token = req.query.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findOne({ email: decoded.email });
        if (!user) return res.status(400).send('<h1>Invalid or expired link</h1><p>Please register again.</p>');

        if (user.isVerified) return res.status(200).send('<h1>Your email is already verified.</h1>');

        user.isVerified = true;
        await user.save();

        res.status(200).send(`<h1>Email Verified Successfully!</h1><p>Hi ${user.username}, you can now log in.</p>`);
    } catch (err) {
        console.error(err);
        res.status(400).send('<h2>Invalid or expired verification link.</h2>');
    }
});

// ========== LOGIN ========== //
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ success: false, message: 'Invalid credentials' });

        if (!user.isVerified) return res.status(403).json({ success: false, message: 'Please verify your email before logging in.' });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(400).json({ success: false, message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, userType: user.userType }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                userType: user.userType,
                profilePhoto: user.profilePhoto
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ========== TEST EMAIL ========== //
router.get('/test-email', async (req, res) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: 'yourgmail@gmail.com',  // for testing
            subject: 'Test Email',
            html: '<h1>SMTP works!</h1>'
        });
        console.log(info);
        res.send('Test email sent! Check Gmail.');
    } catch (err) {
        console.error(err);
        res.send('Error sending email: ' + err.message);
    }
});

router.post("/save-token", async (req, res) => {
  const { userId, token } = req.body;

  await User.findByIdAndUpdate(userId, {
    expoPushToken: token
  });

  res.json({ message: "Token saved" });
});


module.exports = router;
