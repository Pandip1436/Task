// src/api/auth.service.js
import api from "../api/axios";

/* SIGNUP */
export const requestSignupOTP = (data) =>
  api.post("/auth/signup/request-otp", data);

export const verifySignupOTP = (data) =>
  api.post("/auth/signup/verify-otp", data);

/* LOGIN */
export const loginWithPassword = (data) =>
  api.post("/auth/login", data);

export const requestLoginOTP = (data) =>
  api.post("/auth/login/request-otp", data);

export const verifyLoginOTP = (data) =>
  api.post("/auth/login/verify-otp", data);

/* OTP */
export const resendOTP = (data) =>
  api.post("/auth/resend-otp", data);

/* PROFILE */
export const getProfile = () =>
  api.get("/auth/me");

/* LOGOUT */
export const logout = () =>
  api.post("/auth/logout");

export const logoutUser = async () => {
  await logout();
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};