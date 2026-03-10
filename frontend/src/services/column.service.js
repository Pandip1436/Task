import api from "../api/axios";

export const getColumnsByBoard = (boardId) =>
  api.get(`/columns/board/${boardId}`);

export const createColumn = (data) =>
  api.post("/columns", data);

export const updateColumn = (id, data) =>
  api.put(`/columns/${id}`, data);

export const deleteColumn = (id) =>
  api.delete(`/columns/${id}`);
