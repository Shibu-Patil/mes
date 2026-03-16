import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },

    isEmailVerified: {
      type: Boolean,
      default: false
    },

    emailToken: String,

    // ⏰ AUTO DELETE AFTER 10 MIN IF NOT VERIFIED
    expiresAt: {
      type: Date,
      index: { expires: 0 } // TTL index
    },

    // PROFILE IMAGE
    profileImage: {
      data: Buffer,
      contentType: String
    }
  },
  { timestamps: true }
);

// 🔐 Hash password
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

export default mongoose.model("User", userSchema);
