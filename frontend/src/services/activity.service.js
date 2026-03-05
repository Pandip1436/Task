import api from "../api/axios";
import { socketService } from "./socket.service";

export const getActivityLogs = (boardId) => {
  return api.get(`/activity/board/${boardId}`);
};

export const createActivityLog = (logData) => {
  return api.post(`/activity`, logData, {
    headers: {
      "x-socket-id": socketService.id || "",
    },
  });
};

export const deleteActivityLog = (logId) => {
  return api.delete(`/activity/${logId}`, {
    headers: {
      "x-socket-id": socketService.id || "",
    },
  });
};

export const clearBoardActivityLogs = (boardId) => {
  return api.delete(`/activity/board/${boardId}/clear`, {
    headers: {
      "x-socket-id": socketService.id || "",
    },
  });
};

export const getFilteredActivityLogs = (boardId, filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  return api.get(`/activity/board/${boardId}?${params}`);
};