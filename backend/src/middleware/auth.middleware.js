const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Protect routes - verify JWT token
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        message: "Not authorized. Please login to access this resource.",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({
          message: "User not found. Please login again.",
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          message: "Your account has been deactivated.",
        });
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "Token expired. Please login again.",
        });
      }
      return res.status(401).json({
        message: "Invalid token. Please login again.",
      });
    }
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Authorize specific roles
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

/**
 * Optional auth - attach user if token exists, but don't require it
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");
        
        if (user && user.isActive) {
          req.user = user;
        }
      } catch (err) {
        // Token invalid or expired - continue without user
        console.log("Optional auth failed:", err.message);
      }
    }

    next();
  } catch (error) {
    console.error("Optional Auth Middleware Error:", error);
    next();
  }
};