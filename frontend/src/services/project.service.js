import api from "../api/axios";

export const getProjects = () => api.get("/projects");
export const createProject = (data) => api.post("/projects", data);
export const deleteProject = (id) => api.delete(`/projects/${id}`);
export const updateProject = (id, data) =>api.put(`/projects/${id}`, data);
export const getProjectById = (id) =>api.get(`/projects/${id}`);
