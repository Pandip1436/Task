const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const twilio = require("twilio");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/* ============================================ */
/*              SIGNUP PROCESS                 */
/* ============================================ */

/**
 * STEP 1: Request OTP for signup
 * POST /api/auth/signup/request-otp
 */
exports.requestSignupOTP = async (req, res) => {
  try {
    const { phoneNumber, name, email, password } = req.body;

    // Validate required fields
    if (!phoneNumber || !name || !email || !password) {
      return res.status(400).json({
        message: "Please provide all required fields",
      });
    }

    // Validate phone number format (E.164 format: +1234567890)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        message: "Invalid phone number format. Use format (e.g., +9180xxxxxxx)",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: "Email already registered" });
      }
      if (existingUser.phoneNumber === phoneNumber) {
        return res.status(400).json({
          message: "Phone number already registered",
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP with user data temporarily
    otpStore.set(phoneNumber, {
      otp,
      otpExpiry,
      userData: { name, email, password, phoneNumber },
      type: "signup",
    });

    // Send OTP via Twilio
    try {
      await twilioClient.messages.create({
        body: `Your verification code is: ${otp}. Valid for 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      res.status(200).json({
        message: "OTP sent successfully to your phone",
        phoneNumber: phoneNumber.replace(/(\+\d{1,3})\d+(\d{4})/, "$1****$2"), // Mask phone number
      });
    } catch (twilioError) {
      console.error("Twilio Error:", twilioError);
      return res.status(500).json({
        message: "Failed to send OTP. Please check the phone number.",
        error: twilioError.message,
      });
    }
  } catch (error) {
    console.error("Request OTP Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * STEP 2: Verify OTP and complete signup
 * POST /api/auth/signup/verify-otp
 */
exports.verifySignupOTP = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        message: "Phone number and OTP are required",
      });
    }

    // Get stored OTP data
    const otpData = otpStore.get(phoneNumber);

    if (!otpData) {
      return res.status(400).json({
        message: "OTP not found or expired. Please request a new one.",
      });
    }

    // Check if OTP expired
    if (Date.now() > otpData.otpExpiry) {
      otpStore.delete(phoneNumber);
      return res.status(400).json({
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP. Please try again.",
      });
    }

    // Check if this is a signup OTP
    if (otpData.type !== "signup") {
      return res.status(400).json({
        message: "Invalid OTP type",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(otpData.userData.password, salt);

    // Create user
    const user = await User.create({
      name: otpData.userData.name,
      email: otpData.userData.email,
      password: hashedPassword,
      phoneNumber: otpData.userData.phoneNumber,
      isPhoneVerified: true,
    });

    // Clear OTP from store
    otpStore.delete(phoneNumber);

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isPhoneVerified: user.isPhoneVerified,
      },
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ============================================ */
/*              LOGIN PROCESS                  */
/* ============================================ */

/**
 * STEP 1: Request OTP for login
 * POST /api/auth/login/request-otp
 */
exports.requestLoginOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        message: "Phone number is required",
      });
    }

    // Find user by phone number
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res.status(404).json({
        message: "No account found with this phone number",
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(phoneNumber, {
      otp,
      otpExpiry,
      userId: user._id,
      type: "login",
    });

    // Send OTP via Twilio
    try {
      await twilioClient.messages.create({
        body: `Your login code is: ${otp}. Valid for 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      res.status(200).json({
        message: "OTP sent successfully to your phone",
        phoneNumber: phoneNumber.replace(/(\+\d{1,3})\d+(\d{4})/, "$1****$2"),
      });
    } catch (twilioError) {
      console.error("Twilio Error:", twilioError);
      return res.status(500).json({
        message: "Failed to send OTP",
        error: twilioError.message,
      });
    }
  } catch (error) {
    console.error("Request Login OTP Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * STEP 2: Verify OTP and complete login
 * POST /api/auth/login/verify-otp
 */
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        message: "Phone number and OTP are required",
      });
    }

    // Get stored OTP data
    const otpData = otpStore.get(phoneNumber);

    if (!otpData) {
      return res.status(400).json({
        message: "OTP not found or expired. Please request a new one.",
      });
    }

    // Check if OTP expired
    if (Date.now() > otpData.otpExpiry) {
      otpStore.delete(phoneNumber);
      return res.status(400).json({
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP. Please try again.",
      });
    }

    // Check if this is a login OTP
    if (otpData.type !== "login") {
      return res.status(400).json({
        message: "Invalid OTP type",
      });
    }

    // Get user
    const user = await User.findById(otpData.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Update phone verification status
    if (!user.isPhoneVerified) {
      user.isPhoneVerified = true;
      await user.save();
    }

    // Clear OTP from store
    otpStore.delete(phoneNumber);

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isPhoneVerified: user.isPhoneVerified,
      },
    });
  } catch (error) {
    console.error("Verify Login OTP Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ============================================ */
/*         TRADITIONAL EMAIL LOGIN             */
/* ============================================ */

/**
 * Login with email and password
 * POST /api/auth/login
 */
exports.loginWithPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Find user
    const user = await User.findOne({ email });

    if (!user || user.provider !== "local") {
  return res.status(401).json({
    message: "Invalid email or password",
  });
}

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isPhoneVerified: user.isPhoneVerified,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ============================================ */
/*              RESEND OTP                     */
/* ============================================ */

/**
 * Resend OTP
 * POST /api/auth/resend-otp
 */
exports.resendOTP = async (req, res) => {
  try {
    const { phoneNumber, type } = req.body; // type: 'signup' or 'login'

    if (!phoneNumber || !type) {
      return res.status(400).json({
        message: "Phone number and type are required",
      });
    }

    // Get existing OTP data
    const existingOtpData = otpStore.get(phoneNumber);

    if (!existingOtpData) {
      return res.status(400).json({
        message: "No pending OTP request found. Please start the process again.",
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    // Update OTP data
    otpStore.set(phoneNumber, {
      ...existingOtpData,
      otp,
      otpExpiry,
    });

    // Send new OTP
    try {
      await twilioClient.messages.create({
        body: `Your new verification code is: ${otp}. Valid for 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      res.status(200).json({
        message: "New OTP sent successfully",
        phoneNumber: phoneNumber.replace(/(\+\d{1,3})\d+(\d{4})/, "$1****$2"),
      });
    } catch (twilioError) {
      console.error("Twilio Error:", twilioError);
      return res.status(500).json({
        message: "Failed to send OTP",
        error: twilioError.message,
      });
    }
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ============================================ */
/*              GET USER PROFILE               */
/* ============================================ */

/**
 * Get current user profile
 * GET /api/auth/me
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isPhoneVerified: user.isPhoneVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ============================================ */
/*              LOGOUT                         */
/* ============================================ */

/**
 * Logout (client-side token removal)
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    // In a JWT-based system, logout is primarily handled on the client side
    // by removing the token from storage. However, you can implement 
    // token blacklisting here if needed.

    res.status(200).json({
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({ message: error.message });
  }
};
/* ============================================ */
/*              GOOGLE OAUTH LOGIN              */
/* ============================================ */

/**
 * Login or Signup with Google
 * POST /api/auth/google
 */
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        message: "Google credential is required",
      });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const { email, name, picture, email_verified } = payload;

    if (!email_verified) {
      return res.status(400).json({
        message: "Google email not verified",
      });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    // If user does NOT exist → Create new user
    if (!user) {
      user = await User.create({
        name,
        email,
        phoneNumber: null,
        password: null,
        isPhoneVerified: false,
        avatar: picture,
        provider: "google",
      });
    }

    // Generate JWT
    const token = generateToken(user._id);

    res.status(200).json({
      message: "Google login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isPhoneVerified: user.isPhoneVerified,
      },
    });
  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(401).json({
      message: "Google authentication failed",
    });
  }
};


/* ===============================
   FORGOT PASSWORD
================================= */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found with this email",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

    await user.save();

    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const message = `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset.</p>
      <p>Click below to reset your password:</p>
      <a href="${resetURL}" target="_blank">${resetURL}</a>
      <p>This link will expire in 15 minutes.</p>
    `;

    await sendEmail({
      email: user.email,
      subject: "Password Reset - Task Manager",
      message,
    });

    res.status(200).json({
      message: "Password reset email sent successfully",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Email could not be sent" });
  }
};


/* ===============================
   RESET PASSWORD
================================= */
exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;

    // Hash incoming token
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Clear reset fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({
      message: "Password reset successful",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};