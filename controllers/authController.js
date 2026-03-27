import User from "../models/User.js";
import Otp from "../models/Otp.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import generateOtp from "../utils/generateOtp.js";
import sendMail from "../utils/sendMail.js";

/* =========================
   REGISTER
========================= */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });

    const emailToken = crypto.randomBytes(32).toString("hex");

    const profileImage = req.file
      ? {
          data: req.file.buffer,
          contentType: req.file.mimetype
        }
      : undefined;

    const user = await User.create({
      name,
      email,
      password,
      emailToken,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      profileImage
    });

    // remove old OTPs
    await Otp.deleteMany({ email, purpose: "EMAIL_VERIFY" });

    const otp = generateOtp();

    await Otp.create({
      email,
      otp,
      purpose: "EMAIL_VERIFY",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    const verifyLink = `https://mes-ioa3.onrender.com/api/auth/verify-email/${emailToken}`;

    await sendMail(
      email,
      "Verify your email",
      `
        <h2>Hello ${name}</h2>
        <p><b>OTP:</b> ${otp} (valid for 10 minutes)</p>
        <p>OR click the link below:</p>
        <a href="${verifyLink}">Verify Email</a>
      `
    );

    res.status(201).json({
      message: "Registered successfully. Verify within 10 minutes."
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   VERIFY USING OTP
========================= */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const otpDoc = await Otp.findOne({
      email,
      purpose: "EMAIL_VERIFY"
    });

    if (!otpDoc || otpDoc.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired or invalid" });

    if (otpDoc.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    await User.updateOne(
      { email },
      {
        $set: {
          isEmailVerified: true,
          emailToken: null
        },
        $unset: {
          expiresAt: 1 // 🧹 REMOVE TTL
        }
      }
    );

    await Otp.deleteMany({ email, purpose: "EMAIL_VERIFY" });

    res.json({ message: "Email verified successfully (OTP)" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   VERIFY USING EMAIL LINK
========================= */
export const verifyEmailLink = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ emailToken: token });
    if (!user)
      return res.status(400).json({ message: "Invalid or expired link" });

    user.isEmailVerified = true;
    user.emailToken = null;
    user.expiresAt = undefined; // 🧹 REMOVE TTL
    await user.save();

    await Otp.deleteMany({ email: user.email, purpose: "EMAIL_VERIFY" });

    res.json({ message: "Email verified successfully (Link)" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   LOGIN
========================= */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isEmailVerified)
      return res.status(403).json({ message: "Email not verified" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



/* =========================
   UPDATE PASSWORD + PHOTO
========================= */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(userId).select("+password");
    if (!user)
      return res.status(404).json({ message: "User not found" });

    // Update password
    if (newPassword) {
      if (!oldPassword)
        return res.status(400).json({ message: "Old password required" });

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch)
        return res.status(400).json({ message: "Old password incorrect" });

      user.password = newPassword;
    }

    // Update profile photo
    if (req.file) {
      user.profileImage = {
        data: req.file.buffer,
        contentType: req.file.mimetype
      };
    }

    await user.save();

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* =========================
   GET USER BY EMAIL (FOR MESSAGING)
========================= */
export const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      userId: user._id,
      name: user.name,
      email: user.email,
      isEmailVerified: user.isEmailVerified
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};