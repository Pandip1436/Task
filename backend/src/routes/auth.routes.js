const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");

/* ============================================ */
/*              SIGNUP ROUTES                  */
/* ============================================ */

// Step 1: Request OTP for signup
router.post("/signup/request-otp", authController.requestSignupOTP);

// Step 2: Verify OTP and complete signup
router.post("/signup/verify-otp", authController.verifySignupOTP);

/* ============================================ */
/*              LOGIN ROUTES                   */
/* ============================================ */

// Login with email and password (traditional)
router.post("/login", authController.loginWithPassword);

// Step 1: Request OTP for login (OTP-based login)
router.post("/login/request-otp", authController.requestLoginOTP);

// Step 2: Verify OTP and complete login
router.post("/login/verify-otp", authController.verifyLoginOTP);

/* ============================================ */
/*              OTP MANAGEMENT                 */
/* ============================================ */

// Resend OTP
router.post("/resend-otp", authController.resendOTP);

/* ============================================ */
/*              USER PROFILE                   */
/* ============================================ */

// Get current user (protected route)
router.get("/me", protect, authController.getMe);

/* ============================================ */
/*              LOGOUT                         */
/* ============================================ */

// Logout
router.post("/logout", protect, authController.logout);
router.post("/google", authController.googleLogin);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);

module.exports = router;