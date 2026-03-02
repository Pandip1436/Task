import api from "../api/axios";

/* ============================================ */
/*              TASK OPERATIONS                */
/* ============================================ */

export const getTasksByColumn = (columnId) => {
  return api.get(`/tasks/column/${columnId}`);
};

export const createTask = (taskData) => {
  return api.post("/tasks", taskData);
};

export const updateTask = (id, taskData) => {
  return api.put(`/tasks/${id}`, taskData);
};

export const deleteTask = (id) => {
  return api.delete(`/tasks/${id}`);
};

export const moveTask = (id, columnId, order) => {
  return api.patch(`/tasks/${id}/move`, { columnId, order });
};

/* ============================================ */
/*           ATTACHMENT OPERATIONS             */
/* ============================================ */

export const uploadAttachments = async (taskId, files) => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  return api.post(`/tasks/${taskId}/attachments`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const deleteAttachment = (taskId, attachmentId) => {
  return api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
};

export const getDownloadUrl = (taskId, attachmentId) =>
  `${api.defaults.baseURL}/tasks/${taskId}/attachments/${attachmentId}/download`;

/* ============================================ */
/*            COMMENT OPERATIONS               */
/* ============================================ */

/**
 * Get all comments for a task
 */
export const getComments = (taskId) => {
  return api.get(`/tasks/${taskId}/comments`);
};

/**
 * Add a comment to a task
 */
export const addComment = (taskId, commentData) => {
  return api.post(`/tasks/${taskId}/comments`, commentData);
};

/**
 * Update a comment
 */
export const updateComment = (taskId, commentId, commentData) => {
  return api.put(`/tasks/${taskId}/comments/${commentId}`, commentData);
};

/**
 * Delete a comment from a task
 */
export const deleteComment = (taskId, commentId) => {
  return api.delete(`/tasks/${taskId}/comments/${commentId}`);
};

export default api;