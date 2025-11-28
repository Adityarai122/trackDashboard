import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema({
  email: { type: String, required: true }, // Reverted to Email
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: { expires: 300 } } // 5 mins expiry
});

export default mongoose.model("Otp", OtpSchema);