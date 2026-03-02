// src/api/user.service.js

import api from "../api/axios";


/**
 * Get all active users
 */
export const getAllUsers = () => {
  return api.get("/users");
};

/**
 * Search users by name or email
 */
export const searchUsers = (query) => {
  return api.get("/users/search", {
    params: { query }
  });
};

/**
 * Assign users to a task
 */
export const assignUsersToTask = (taskId, userIds) => {
  return api.post(`/tasks/${taskId}/assign`, { userIds });
};

/**
 * Unassign user from task
 */
export const unassignUserFromTask = (taskId, userId) => {
  return api.delete(`/tasks/${taskId}/assign/${userId}`);
};

/**
 * Get tasks assigned to current user
 */
export const getMyAssignedTasks = () => {
  return api.get("/tasks/assigned-to-me");
};

export default {
  getAllUsers,
  searchUsers,
  assignUsersToTask,
  unassignUserFromTask,
  getMyAssignedTasks
};