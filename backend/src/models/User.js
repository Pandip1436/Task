const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },

    password: {
      type: String,
      required: function () {
        return this.provider === "local";
      },
      minlength: [6, "Password must be at least 6 characters"],
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    phoneNumber: {
      type: String,
      unique: true,
      sparse: true, 
      trim: true,
      match: [
        /^\+[1-9]\d{1,14}$/,
        "Please provide a valid phone number in format (e.g., +9180xxxxx)",
      ],
    },

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    avatar: {
      type: String,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);