 const userService = require("../models/User");

// ── GET /api/users ────────────────────────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const { q } = req.query;

    const users = q
      ? await userService.searchUsers(q)
      : await userService.getAllUsers();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/users/:id ────────────────────────────────────────────────────────
exports.getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    const status = err.message === "User not found" ? 404 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

// ── POST /api/users ───────────────────────────────────────────────────────────
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "name, email and password are required",
      });
    }

    const user = await userService.createUser({ name, email, password, role });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    const status = err.message === "Email already in use" ? 409 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────
exports.updateUser = async (req, res) => {
  try {
    // Users can only update their own profile unless admin
    if (req.user._id.toString() !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this profile",
      });
    }

    const user = await userService.updateUser(req.params.id, req.body);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    const status = err.message === "User not found" ? 404 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/users/:id/password ─────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to change this password",
      });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "currentPassword and newPassword are required",
      });
    }

    const result = await userService.changePassword(req.params.id, {
      currentPassword,
      newPassword,
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    const status = err.message === "Current password is incorrect" ? 401 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    // Only admins or the user themselves can deactivate
    if (req.user._id.toString() !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this user",
      });
    }

    const result = await userService.deleteUser(req.params.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    const status = err.message === "User not found" ? 404 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};
