import api from "../api/axios";

export const getBoardsByProject = (projectId) =>api.get(`/boards/project/${projectId}`);
export const getBoard = (id) => api.get(`/boards/${id}`);

export const createBoard = (data) => api.post("/boards", data);
export const deleteBoard = (id) => api.delete(`/boards/${id}`);
export const updateBoard = (id, data) =>api.put(`/boards/${id}`, data);