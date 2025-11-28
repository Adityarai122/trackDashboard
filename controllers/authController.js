import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import Otp from '../models/Otp.js';
import dotenv from 'dotenv';

dotenv.config();

const { 
  ADMIN_EMAIL = 'admin@example.com', 
  EMAIL_USER = '', 
  EMAIL_PASS = '', 
  JWT_SECRET = 'super-secret-factory-key-123' 
} = process.env;

// Email Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// 1. Send OTP (Email)
async function sendOtp(req, res) {
  try {
    const { email } = req.body;
    console.log("mae chala hu")
    // Strict Access Control
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ error: "Access Denied: Email not authorized." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to DB
    await Otp.findOneAndUpdate(
      { email },
      { otp, createdAt: new Date() },
      { upsert: true, new: true }
    );
console.log(EMAIL_USER)
    // Send Email
    await transporter.sendMail({
      from: `"Factory Admin" <${EMAIL_USER}>`,
      to: email,
      subject: "Your Admin Access Code",
      text: `Your Verification Code is: ${otp}\n\nIt expires in 5 minutes.`,
    });

    console.log(`✅ Email sent to ${email}`);
    res.json({ message: "OTP sent to your email" });

  } catch (err) {
    console.error("OTP Error:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
};

// 2. Verify OTP & Login
async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;

    const record = await Otp.findOne({ email });

    if (!record || record.otp !== otp) {
      return res.status(400).json({ error: "Invalid or Expired OTP" });
    }

    // Success: Generate Token
    const token = jwt.sign({ role: "admin", email }, JWT_SECRET, { expiresIn: "1d" });

    // Delete used OTP
    await Otp.deleteOne({ email });

    res.json({ token, message: "Login Successful" });

  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
};

export default { sendOtp, verifyOtp };