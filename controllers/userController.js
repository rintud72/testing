const User = require('../models/user');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const generateOTP = require('../utils/otpgenerator');


// =======================
// 🧾 REGISTER USER + SEND OTP
// =======================
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Generate OTP (6 digits) valid for 10 minutes
    const otp = generateOTP(6);
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    const newUser = new User({
      name,
      email,
      password,
      phoneOtp: otp,
      otpExpiresAt: otpExpiry,
      isVerified: false,
    });

    await newUser.save();

    // Send OTP via Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Medicine Shop" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'OTP Verification - Medicine Shop',
      text: `Hello ${name},\n\nYour OTP for verification is: ${otp}\nThis OTP will expire in 10 minutes.\n\n- Medicine Shop`,
    });

    res.status(201).json({ message: 'OTP sent to your email. Please verify your account.' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};


// =======================
// 🔐 VERIFY OTP
// =======================
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.isVerified) return res.json({ message: 'User already verified' });
    if (user.phoneOtp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (Date.now() > user.otpExpiresAt) return res.status(400).json({ message: 'OTP expired' });

    user.isVerified = true;
    user.phoneOtp = null;
    user.otpExpiresAt = null;
    await user.save();

    res.json({ message: 'User verified successfully ✅' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};


// =======================
// 🔓 LOGIN USER
// =======================
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Select password field manually
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Must be verified
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Account not verified. Please verify OTP first.' });
    }

    // Compare password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful ✅',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};


// =======================
// 🔁 FORGOT PASSWORD (SEND OTP)
// =======================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = generateOTP(6);
    user.phoneOtp = otp;
    user.otpExpiresAt = Date.now() + 10 * 60 * 1000;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Medicine Shop" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Password OTP - Medicine Shop',
      text: `Your OTP for resetting password is: ${otp}. It will expire in 10 minutes.`,
    });

    res.json({ message: 'Password reset OTP sent to your email.' });
  } catch (error) {
    console.error('Error sending reset OTP:', error);
    res.status(500).json({ message: 'Error sending reset OTP', error: error.message });
  }
};


// =======================
// 🔐 VERIFY RESET OTP
// =======================
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.phoneOtp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (Date.now() > user.otpExpiresAt) return res.status(400).json({ message: 'OTP expired' });

    res.json({ message: 'OTP verified. You can now reset your password.' });
  } catch (error) {
    console.error('Error verifying reset OTP:', error);
    res.status(500).json({ message: 'Error verifying reset OTP', error: error.message });
  }
};


exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    console.log("🔁 Reset Password called for:", email);

    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    // 🔧 Use direct update instead of save()
    const updatedUser = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          password: hashed,
          phoneOtp: null,
          otpExpiresAt: null
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ Password force-updated for", email);
    console.log("🔒 New hash:", updatedUser.password);

    res.json({ message: "Password reset successfully ✅ You can now log in with your new password." });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Error resetting password", error: error.message });
  }
};




// =======================
// 👤 Get Logged-in User Profile
// =======================
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // JWT থেকে পাওয়া userId

    const user = await User.findById(userId).select("-password -phoneOtp -otpExpiresAt");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Error fetching profile", error: error.message });
  }
};

// =======================
// ✏️ Update User Profile
// =======================
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, email } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, email },
      { new: true, runValidators: true }
    ).select("-password -phoneOtp -otpExpiresAt");

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Profile updated successfully ✅", user: updatedUser });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Error updating profile", error: error.message });
  }
};


// =======================
// 👤 Get User Profile (Protected)
// =======================
exports.getProfile = async (req, res) => {
  try {
    // 🔹 req.user এ JWT decoded data থাকে (authenticateToken middleware সেট করে দেয়)
    const user = req.user;

    // ✅ Successful response
    res.status(200).json({
      message: "User profile fetched successfully ✅",
      user,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Error fetching profile", error: error.message });
  }
};


// =======================
// ✏️ Update User Profile (Protected)
// =======================
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // 🔹 JWT থেকে পাওয়া ID
    const { name, email } = req.body;

    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (email) updatedFields.email = email;

    if (Object.keys(updatedFields).length === 0) {
      return res.status(400).json({ message: "No data provided to update" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updatedFields },
      { new: true }
    ).select("-password"); // password বাদ

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully ✅",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Error updating profile", error: error.message });
  }
};
