/* eslint-disable no-unused-vars */
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getProjects, createProject, deleteProject, updateProject } from "../services/project.service";
import { logoutUser } from "../services/auth.service";
import { socketService } from "../services/socket.service";

export default function DashboardPage() {
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    
    if (!token) {
      navigate("/login");
      return;
    }
    
    if (userData) {
      setUser(JSON.parse(userData));
    }
    
    loadProjects();
  }, [navigate]);
  useEffect(() => {
  const socket = socketService.connect();

  // listen for project events
  socket.on("project:created", ({ project }) => {
    setProjects(prev => {
      const exists = prev.some(p => p._id === project._id);
      if (exists) return prev;
      return [...prev, project];
    });
  });

  socket.on("project:updated", ({ project }) => {
    setProjects(prev =>
      prev.map(p => (p._id === project._id ? project : p))
    );
  });

  socket.on("project:deleted", ({ projectId }) => {
    setProjects(prev =>
      prev.filter(p => p._id !== projectId)
    );
  });

  return () => {
    socket.off("project:created");
    socket.off("project:updated");
    socket.off("project:deleted");
  };
}, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getProjects();
      setProjects(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }
      setError("Failed to load projects");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      setCreating(true);
      await createProject({ name: newProjectName, description: newProjectDescription });
      setNewProjectName("");
      setNewProjectDescription("");
      setShowCreateModal(false);
      loadProjects();
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setError("Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleEditProject = (project, e) => {
    e.stopPropagation();
    setEditingProject(project);
    setNewProjectName(project.name);
    setNewProjectDescription(project.description || "");
    setShowEditModal(true);
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim() || !editingProject) return;

    try {
      setUpdating(true);
      await updateProject(editingProject._id, {
        name: newProjectName,
        description: newProjectDescription,
      });
      setNewProjectName("");
      setNewProjectDescription("");
      setEditingProject(null);
      setShowEditModal(false);
      loadProjects();
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setError("Failed to update project");
    } finally {
      setUpdating(false);
    }
  };
  const [deleteProjectModal, setDeleteProjectModal] = useState({
  open: false,
  projectId: null,
});


 const handleDeleteProject = (id) => {
  setDeleteProjectModal({
    open: true,
    projectId: id,
  });
};
const confirmDeleteProject = async () => {
  try {
    await deleteProject(deleteProjectModal.projectId);
    setDeleteProjectModal({ open: false, projectId: null });
    loadProjects();
  } catch (err) {
    if (err.response?.status === 401) {
      navigate("/login");
      return;
    }
    setError("Failed to delete project");
  }
};


  const handleLogout = async () => {
    try {
      await logoutUser();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  const getUserInitials = () => {
    if (!user || !user.name) return "U";
    return user.name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mb-4"></div>
          <p className="text-xl font-semibold text-white">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  TaskFlow
                </h1>
                <p className="text-xs text-slate-400">Project Management</p>
              </div>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all border border-slate-700/50"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-bold text-sm">
                  {getUserInitials()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold">{user?.name || "User"}</p>
                  <p className="text-xs text-slate-400">{user?.email || "user@example.com"}</p>
                </div>
                <svg 
                  className={`w-4 h-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setUserMenuOpen(false)}
                  ></div>
                  <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="p-2 space-y-1">
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile
                      </button>
                      
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </button>

                      <div className="my-1 border-t border-slate-700/50"></div>

                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
          <h2 className="text-3xl lg:text-4xl font-bold mb-2">
            Welcome back, {user?.name?.split(' ')[0] || 'User'}!
          </h2>
          <p className="text-slate-400">
            Manage your projects and track your progress
          </p>
          </div>
           <div className="flex items-center gap-4">
              <div className="px-4 md:px-5 py-2 md:py-2.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="p-3 bg-purple-500/20 rounded-xl">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs md:text-sm font-semibold text-purple-300">
                    {projects.length} Active {projects.length === 1 ? "Project" : "Projects"}
                  </span>
                </div>
              </div>
            </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="font-semibold text-red-300">Error</h3>
                <p className="text-sm text-red-200">{error}</p>
              </div>
            </div>
            <button onClick={() => setError(null)} className="text-red-300 hover:text-red-100">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* Projects Section */}
        <div className="flex items-center justify-between mb-6 mt-5" >
          <h3 className="text-2xl font-bold">Your Projects</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold shadow-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Project
          </button>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-slate-800/50 rounded-full mb-6">
              <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">No projects yet</h3>
            <p className="text-slate-400 mb-6">Create your first project to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold shadow-lg transition-all"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => {
              const colors = [
                { from: "from-purple-500", to: "to-pink-500", bg: "bg-purple-500/10", border: "border-purple-500/30" },
                { from: "from-blue-500", to: "to-cyan-500", bg: "bg-blue-500/10", border: "border-blue-500/30" },
                { from: "from-emerald-500", to: "to-teal-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
                { from: "from-orange-500", to: "to-red-500", bg: "bg-orange-500/10", border: "border-orange-500/30" },
                { from: "from-indigo-500", to: "to-purple-500", bg: "bg-indigo-500/10", border: "border-indigo-500/30" },
              ];
              const color = colors[index % colors.length];

              return (
                <div
                  key={project._id}
                  className="group bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-2 transition-all duration-300 cursor-pointer"
                  onClick={() => navigate(`/projects/${project._id}`)}
                >
                  {/* Card Header */}
                  <div className={`bg-gradient-to-r ${color.from} ${color.to} p-6`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-white mb-1 line-clamp-2">
                          {project.name}
                        </h4>
                      </div>
                      <svg
                        className="w-6 h-6 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0 ml-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6">
                    <p className="text-sm text-slate-400 line-clamp-2 mb-6 min-h-[40px]">
                      {project.description || "No description provided"}
                    </p>

                    <div className={`flex items-center gap-2 px-3 py-2 ${color.bg} border ${color.border} rounded-lg mb-4`}>
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="text-xs font-semibold text-purple-300">
                        Click to view board
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleEditProject(project, e)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 rounded-lg transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project._id);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Create New Project</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName("");
                  setNewProjectDescription("");
                }}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-900/50 border-2 border-slate-700 focus:border-purple-500 px-4 py-3 rounded-xl outline-none transition-all text-white"
                  placeholder="Enter project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-900/50 border-2 border-slate-700 focus:border-purple-500 px-4 py-3 rounded-xl outline-none transition-all resize-none text-white"
                  placeholder="Brief description (optional)"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewProjectName("");
                    setNewProjectDescription("");
                  }}
                  className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-600 disabled:to-slate-700 rounded-xl font-semibold shadow-lg transition-all disabled:cursor-not-allowed"
                >
                  {creating ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleteProjectModal.open && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl shadow-2xl p-6">

      <h2 className="text-lg font-semibold text-white">
        Delete Project Permanently?
      </h2>

      <p className="text-gray-400 mt-3 text-sm leading-relaxed">
        This project and all associated boards, tasks, and activity history 
        will be permanently removed.
        <span className="block mt-2 text-red-400 font-medium">
          This action cannot be undone.
        </span>
      </p>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={() => setDeleteProjectModal({ open: false, projectId: null })}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
        >
          Cancel
        </button>

        <button
          onClick={confirmDeleteProject}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition shadow-lg"
        >
          Delete Permanently
        </button>
      </div>

    </div>
  </div>
)}


      {/* Edit Project Modal */}
      {showEditModal && editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Edit Project</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProject(null);
                  setNewProjectName("");
                  setNewProjectDescription("");
                }}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-900/50 border-2 border-slate-700 focus:border-blue-500 px-4 py-3 rounded-xl outline-none transition-all text-white"
                  placeholder="Enter project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-900/50 border-2 border-slate-700 focus:border-blue-500 px-4 py-3 rounded-xl outline-none transition-all resize-none text-white"
                  placeholder="Brief description (optional)"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProject(null);
                    setNewProjectName("");
                    setNewProjectDescription("");
                  }}
                  className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-slate-600 disabled:to-slate-700 rounded-xl font-semibold shadow-lg transition-all disabled:cursor-not-allowed"
                >
                  {updating ? "Updating..." : "Update Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}