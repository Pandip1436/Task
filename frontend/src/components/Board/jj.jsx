/* eslint-disable no-unused-vars */
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getColumnsByBoard,
  createColumn,
  updateColumn,
  deleteColumn,
} from "../services/column.service";
import {
  getTasksByColumn,
  createTask,
  updateTask,
  deleteTask,
  uploadAttachments,
  deleteAttachment,
  getDownloadUrl,
  addComment,
  deleteComment,
} from "../services/task.service";
import { assignUsersToTask, unassignUserFromTask } from "../services/user.service";
import UserAssignmentDropdown from "../components/UserAssignmentDropdown";

export default function TasksPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();

  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState({});
  const [newColumn, setNewColumn] = useState("");
  const [newTask, setNewTask] = useState({});
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalTask, setModalTask] = useState(null);
  const [modalData, setModalData] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    columnId: "",
    attachments: [],
    comments: [],
    assignedTo: [], 
  });
  const [newComment, setNewComment] = useState("");
  const [selectedUserFilter, setSelectedUserFilter] = useState("all");
  const [availableUsers, setAvailableUsers] = useState([]);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
  }, [navigate]);

  const toDateInputValue = (date) => {
    if (!date) return "";
    return new Date(date).toISOString().split("T")[0];
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const colRes = await getColumnsByBoard(boardId);
      setColumns(colRes.data);

      const taskPromises = colRes.data.map((col) =>
        getTasksByColumn(col._id).then((res) => ({ id: col._id, data: res.data }))
      );

      const taskResults = await Promise.all(taskPromises);
      const map = {};
      taskResults.forEach((result) => {
        map[result.id] = result.data;
      });

      setTasks(map);
    } catch (err) {
      // Handle auth errors
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }
      setError(err.message || "Failed to load board data");
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [boardId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  // Extract unique users from all tasks
useEffect(() => {
  const users = new Map();
  Object.values(tasks).forEach(taskList => {
    taskList.forEach(task => {
      if (task.assignedTo && Array.isArray(task.assignedTo)) {
        task.assignedTo.forEach(user => {
          if (user && user._id) {
            users.set(user._id, user);
          }
        });
      }
    });
  });
  setAvailableUsers(Array.from(users.values()));
}, [tasks]);


  /* COLUMN */
  const addColumn = async () => {
    if (!newColumn.trim()) return;
    try {
      await createColumn({ name: newColumn, boardId });
      setNewColumn("");
      load();
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setError("Failed to add column");
    }
  };

  const startEditColumn = (col) => {
    setEditingColumnId(col._id);
    setEditingColumnName(col.name);
  };

  const saveEditColumn = async () => {
    try {
      await updateColumn(editingColumnId, { name: editingColumnName });
      setEditingColumnId(null);
      setEditingColumnName("");
      load();
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setError("Failed to update column");
    }
  };

  const removeColumn = async (id) => {
    if (!confirm("Delete column and its tasks?")) return;
    try {
      await deleteColumn(id);
      load();
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setError("Failed to delete column");
    }
  };

  /* TASK */
  const addTask = async (columnId) => {
    if (!newTask[columnId]?.trim()) return;
    try {
      await createTask({
        title: newTask[columnId],
        columnId,
        boardId,
      });
      setNewTask({ ...newTask, [columnId]: "" });
      load();
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setError("Failed to add task");
    }
  };

  const startEditTask = (task) => {
    setEditingTaskId(task._id);
    setEditingTaskTitle(task.title);
  };

  const saveEditTask = async () => {
    try {
      await updateTask(editingTaskId, { title: editingTaskTitle });
      setEditingTaskId(null);
      setEditingTaskTitle("");
      load();
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setError("Failed to update task");
    }
  };

  const removeTask = async (id) => {
    try {
      await deleteTask(id);
      load();
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setError("Failed to delete task");
    }
  };

  const handleKeyPress = (e, action) => {
    if (e.key === "Enter") action();
  };

  const openTaskModal = (task) => {
    setModalTask(task);
    setModalData({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      dueDate: toDateInputValue(task.dueDate),
      columnId: task.column || "",
      attachments: task.attachments || [],
      comments: task.comments || [],
      assignedTo: task.assignedTo || [], 
    });
  };

  const closeTaskModal = () => {
    setModalTask(null);
    setModalData({
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
      columnId: "",
      attachments: [],
      comments: [],
      assignedTo: [],
    });
    setNewComment("");
  };

  const saveTaskModal = async () => {
    try {
      await updateTask(modalTask._id, modalData);
      
      const newFiles = modalData.attachments
        .filter(att => att.file)
        .map(att => att.file);

      if (newFiles.length > 0) {
        await uploadAttachments(modalTask._id, newFiles);
      }

      closeTaskModal();
      load();
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setError("Failed to update task");
    }
  };

  const handleFileAttach = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
      file: file,
    }));
    setModalData({
      ...modalData,
      attachments: [...(modalData.attachments || []), ...newAttachments],
    });
  };

  const removeAttachment = async (attachment) => {
    try {
      if (attachment._id) {
        await deleteAttachment(modalTask._id, attachment._id);
      }
      
      setModalData({
        ...modalData,
        attachments: modalData.attachments.filter(att => 
          att.id ? att.id !== attachment.id : att._id !== attachment._id
        ),
      });
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/login");
        return;
      }
      setError("Failed to delete attachment");
    }
  };

  /* USER ASSIGNMENT */
const handleAssignUsers = async (userIds) => {
  const previousAssigned = modalData.assignedTo;

  const newUsers = userIds.filter(
    id => !previousAssigned.some(u => u._id === id)
  );

  const newUserObjects = availableUsers.filter(user =>
    newUsers.includes(user._id)
  );

  const updatedAssigned = [...previousAssigned, ...newUserObjects];

  setModalData(prev => ({
    ...prev,
    assignedTo: updatedAssigned,
  }));

  setTasks(prev => ({
    ...prev,
    [modalTask.column]: prev[modalTask.column].map(task =>
      task._id === modalTask._id
        ? { ...task, assignedTo: updatedAssigned }
        : task
    ),
  }));

  try {
    await assignUsersToTask(modalTask._id, userIds);
  } catch (err) {
    setModalData(prev => ({
      ...prev,
      assignedTo: previousAssigned,
    }));

    setTasks(prev => ({
      ...prev,
      [modalTask.column]: prev[modalTask.column].map(task =>
        task._id === modalTask._id
          ? { ...task, assignedTo: previousAssigned }
          : task
      ),
    }));

    setError("Failed to assign users");
  }
};


const handleUnassignUser = async (userId) => {
  const previousAssigned = modalData.assignedTo;

  const updatedAssigned = previousAssigned.filter(
    user => user._id !== userId
  );

  // 🔥 Update modal instantly
  setModalData(prev => ({
    ...prev,
    assignedTo: updatedAssigned,
  }));

  setTasks(prev => ({
    ...prev,
    [modalTask.column]: prev[modalTask.column].map(task =>
      task._id === modalTask._id
        ? { ...task, assignedTo: updatedAssigned }
        : task
    ),
  }));

  try {
    await unassignUserFromTask(modalTask._id, userId);
  } catch (err) {
    setModalData(prev => ({
      ...prev,
      assignedTo: previousAssigned,
    }));

    setTasks(prev => ({
      ...prev,
      [modalTask.column]: prev[modalTask.column].map(task =>
        task._id === modalTask._id
          ? { ...task, assignedTo: previousAssigned }
          : task
      ),
    }));

    setError("Failed to unassign user");
  }
};


  /* COMMENTS */
const handleAddComment = async () => {
  const text = newComment.trim();
  if (!text) return;

  const tempComment = {
    _id: "temp-" + Date.now(),
    text,
    createdAt: new Date().toISOString(),
    author: JSON.parse(localStorage.getItem("user")),
  };

  const previousComments = modalData.comments;

  setModalData(prev => ({
    ...prev,
    comments: [...prev.comments, tempComment],
  }));

  setTasks(prev => ({
    ...prev,
    [modalTask.column]: prev[modalTask.column].map(task =>
      task._id === modalTask._id
        ? { ...task, comments: [...(task.comments || []), tempComment] }
        : task
    ),
  }));

  setNewComment("");

  try {
    const res = await addComment(modalTask._id, { text });

    setModalData(prev => ({
      ...prev,
      comments: prev.comments.map(c =>
        c._id === tempComment._id ? res.data : c
      ),
    }));

    setTasks(prev => ({
      ...prev,
      [modalTask.column]: prev[modalTask.column].map(task =>
        task._id === modalTask._id
          ? {
              ...task,
              comments: task.comments.map(c =>
                c._id === tempComment._id ? res.data : c
              ),
            }
          : task
      ),
    }));
  } catch (err) {
    setModalData(prev => ({
      ...prev,
      comments: previousComments,
    }));

    setTasks(prev => ({
      ...prev,
      [modalTask.column]: prev[modalTask.column].map(task =>
        task._id === modalTask._id
          ? { ...task, comments: previousComments }
          : task
      ),
    }));

    setError("Failed to add comment");
  }
};


const handleDeleteComment = async (commentId) => {
  const previousComments = modalData.comments;

  const updatedComments = previousComments.filter(
    c => c._id !== commentId
  );

  setModalData(prev => ({
    ...prev,
    comments: updatedComments,
  }));

  
  setTasks(prev => ({
    ...prev,
    [modalTask.column]: prev[modalTask.column].map(task =>
      task._id === modalTask._id
        ? { ...task, comments: updatedComments }
        : task
    ),
  }));

  try {
    await deleteComment(modalTask._id, commentId);
  } catch (err) {
    
    setModalData(prev => ({
      ...prev,
      comments: previousComments,
    }));

    setTasks(prev => ({
      ...prev,
      [modalTask.column]: prev[modalTask.column].map(task =>
        task._id === modalTask._id
          ? { ...task, comments: previousComments }
          : task
      ),
    }));

    setError("Failed to delete comment");
  }
};


  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatCommentTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  // Helper to get user initials
  const getUserInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  // Filter tasks by selected user
const filterTasksByUser = (taskList) => {
  if (selectedUserFilter === "all") {
    return taskList;
  }
  return taskList.filter(task => {
    if (!task.assignedTo || !Array.isArray(task.assignedTo)) return false;
    return task.assignedTo.some(user => user._id === selectedUserFilter);
  });
};

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4"></div>
          <p className="text-xl font-semibold text-gray-700">Loading your board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-300 via-purple-300 to-pink-300">
      {/* Premium Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-gray-200/50 shadow-lg">
        <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 sm:gap-6">
              <button
                onClick={() => navigate(-1)}
                className="group flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-all duration-200"
                aria-label="Go back"
              >
                <svg
                  className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span className="font-medium hidden sm:inline">Back</span>
              </button>
              <div className="h-6 sm:h-8 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Task Board
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5 hidden sm:block">
                  Organize and track your work
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-200/50">
                <span className="text-xs sm:text-sm font-medium text-gray-700">
                  {columns.length} {columns.length === 1 ? "Column" : "Columns"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 mt-4 sm:mt-6">
          <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl p-3 sm:p-4 flex items-start justify-between shadow-sm">
            <div className="flex items-start gap-2 sm:gap-3">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-red-800 text-sm sm:text-base">Error</h3>
                <p className="text-xs sm:text-sm text-red-700">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
              aria-label="Dismiss error"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    {/* User Filter Section */}
{availableUsers.length > 0 && (
  <div className="max-w-[2000px] mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
    <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/50 p-3 sm:p-4 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Header */}
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-xs sm:text-sm font-semibold text-gray-700">Filter by User:</span>
          </div>
          
          {/* Clear Filter Button - Mobile (Top Right) */}
          {selectedUserFilter !== "all" && (
            <button
              onClick={() => setSelectedUserFilter("all")}
              className="sm:hidden flex items-center gap-1.5 px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-all text-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </div>
        
        {/* Filter Buttons Container */}
        <div className="flex flex-col sm:flex-row sm:flex-1 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* All Tasks Button */}
            <button
              onClick={() => setSelectedUserFilter("all")}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm flex-1 sm:flex-initial justify-center sm:justify-start ${
                selectedUserFilter === "all"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="hidden xs:inline">All Tasks</span>
              <span className="xs:hidden">All</span>
              <span className="px-1.5 sm:px-2 py-0.5 bg-white/20 rounded-full text-[10px] sm:text-xs">
                {Object.values(tasks).reduce((sum, taskList) => sum + taskList.length, 0)}
              </span>
            </button>

            {/* User Filter Buttons */}
            {availableUsers.map((user) => {
              const userTaskCount = Object.values(tasks).reduce((sum, taskList) => {
                return sum + taskList.filter(task => 
                  task.assignedTo?.some(u => u._id === user._id)
                ).length;
              }, 0);

              return (
                <button
                  key={user._id}
                  onClick={() => setSelectedUserFilter(user._id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all text-xs sm:text-sm flex-1 sm:flex-initial justify-center sm:justify-start min-w-0 ${
                    selectedUserFilter === user._id
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-[10px] sm:text-xs flex-shrink-0">
                    {getUserInitials(user.name)}
                  </div>
                  <span className="truncate">{user.name}</span>
                  <span className="px-1.5 sm:px-2 py-0.5 bg-white/20 rounded-full text-[10px] sm:text-xs flex-shrink-0">
                    {userTaskCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Clear Filter Button - Desktop */}
          {selectedUserFilter !== "all" && (
            <button
              onClick={() => setSelectedUserFilter("all")}
              className="hidden sm:flex items-center gap-2 ml-auto px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-all text-sm"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
)}

      {/* Add Column Section */}
      <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-4 sm:p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg flex-shrink-0">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <input
                className="flex-1 bg-white/80 border-2 border-gray-200 focus:border-indigo-400 px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl outline-none transition-all duration-200 placeholder-gray-400 font-medium shadow-sm text-sm sm:text-base"
                placeholder="Add a new column"
                value={newColumn}
                onChange={(e) => setNewColumn(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, addColumn)}
              />
            </div>
            <button
              onClick={addColumn}
              className="px-6 sm:px-8 py-2.5 sm:py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-sm sm:text-base"
            >
              Add Column
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board - Continuing in next part due to size... */}
      <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12">
        <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
          {columns.map((col, index) => {
              const columnTasks = Array.isArray(tasks[col._id])
               ? tasks[col._id]
               : [];

            const filteredTasks = filterTasksByUser(columnTasks);
            const columnColors = [
              { from: "from-blue-500", to: "to-cyan-500", bg: "bg-blue-50", border: "border-blue-200" },
              { from: "from-purple-500", to: "to-pink-500", bg: "bg-purple-50", border: "border-purple-200" },
              { from: "from-emerald-500", to: "to-teal-500", bg: "bg-emerald-50", border: "border-emerald-200" },
              { from: "from-orange-500", to: "to-red-500", bg: "bg-orange-50", border: "border-orange-200" },
              { from: "from-indigo-500", to: "to-purple-500", bg: "bg-indigo-50", border: "border-indigo-200" },
            ];
            const colors = columnColors[index % columnColors.length];

            return (
              <div
                key={col._id}
                className="w-[280px] sm:w-[320px] lg:w-[360px] flex-shrink-0 flex flex-col"
              >
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl overflow-hidden flex flex-col h-full">
                  {/* Column Header */}
                  <div className={`bg-gradient-to-r ${colors.from} ${colors.to} p-4 sm:p-5`}>
                    {editingColumnId === col._id ? (
                      <div className="flex gap-2">
                        <input
                          className="flex-1 bg-white/95 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-gray-800 outline-none shadow-inner text-sm sm:text-base"
                          value={editingColumnName}
                          onChange={(e) => setEditingColumnName(e.target.value)}
                          onKeyPress={(e) => handleKeyPress(e, saveEditColumn)}
                          autoFocus
                        />
                        <button
                          onClick={saveEditColumn}
                          className="px-3 sm:px-4 bg-white text-green-600 rounded-lg hover:bg-green-50 transition-colors shadow-md font-bold text-sm sm:text-base"
                          aria-label="Save column name"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <h2 className="font-bold text-white text-base sm:text-lg tracking-wide">
                            {col.name}
                          </h2>
                          <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-white/20 rounded-full">
                            <span className="text-xs font-bold text-white">
                              {filteredTasks.length}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1.5 sm:gap-2">
                          <button
                            onClick={() => startEditColumn(col)}
                            className="p-1.5 sm:p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur-sm"
                            aria-label="Edit column"
                          >
                            <svg
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeColumn(col._id)}
                            className="p-1.5 sm:p-2 bg-white/20 hover:bg-red-500 rounded-lg transition-colors backdrop-blur-sm"
                            aria-label="Delete column"
                          >
                            <svg
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tasks Container */}
                  <div className="flex-1 p-3 sm:p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-400px)] custom-scrollbar">
                    {(filteredTasks).length === 0 ? (
                      <div className="text-center py-8 sm:py-12">
                        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full mb-3">
                          <svg
                            className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <p className="text-gray-400 text-xs sm:text-sm font-medium">No tasks yet</p>
                      </div>
                    ) : (
                      (filteredTasks).map((task) => (
                        <div
                          key={task._id}
                          className="group bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-lg transition-all duration-200 hover:border-gray-300 cursor-pointer"
                          onClick={() => openTaskModal(task)}
                        >
                          <div className="flex justify-between items-start gap-2 sm:gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-800 font-medium leading-relaxed mb-2 text-sm sm:text-base">
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-gray-500 text-xs sm:text-sm line-clamp-2 mb-2">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                {task.priority && (
                                  <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-semibold ${
                                    task.priority === "high" ? "bg-red-100 text-red-700" :
                                    task.priority === "medium" ? "bg-yellow-100 text-yellow-700" :
                                    "bg-green-100 text-green-700"
                                  }`}>
                                    {task.priority === "high" ? "High" : task.priority === "medium" ? "Medium" : "Low"}
                                  </span>
                                )}
                                {task.dueDate && (
                                  <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold flex items-center gap-1">
                                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="truncate">{formatDate(task.dueDate)}</span>
                                  </span>
                                )}
                                {task.attachments && task.attachments.length > 0 && (
                                  <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold flex items-center gap-1">
                                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    <span>{task.attachments.length}</span>
                                  </span>
                                )}
                                {task.comments && task.comments.length > 0 && (
                                  <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold flex items-center gap-1">
                                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <span>{task.comments.length}</span>
                                  </span>
                                )}
                              </div>
                              {/* ASSIGNED USERS DISPLAY ON CARD */}
                              {task.assignedTo && task.assignedTo.length > 0 && (
                                <div className="flex items-center gap-1 mt-2">
                                  <svg className="w-3 h-3 text-gray-500  flex-shrink-0" fill="blue" stroke="black" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  <div className="flex -space-x-1">
                                    {task.assignedTo.slice(0, 3).map((user) => (
                                      <div
                                        key={user._id}
                                        className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold border border-white"
                                        title={user.name}
                                      >
                                        {getUserInitials(user.name)}
                                      </div>
                                    ))}
                                    {task.assignedTo.length > 3 && (
                                      <div className="w-5 h-5 bg-gray-400 text-white rounded-full flex items-center justify-center text-[10px] font-bold border border-white">
                                        +{task.assignedTo.length - 3}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Task Input */}
                  <div className="p-3 sm:p-4 border-t border-gray-200 bg-gray-50/50">
                    <div className="flex gap-2">
                      <input
                        className="flex-1 bg-white border-2 border-gray-200 focus:border-indigo-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg outline-none transition-colors placeholder-gray-400 text-xs sm:text-sm font-medium"
                        placeholder="Add a task..."
                        value={newTask[col._id] || ""}
                        onChange={(e) =>
                          setNewTask({
                            ...newTask,
                            [col._id]: e.target.value,
                          })
                        }
                        onKeyPress={(e) => handleKeyPress(e, () => addTask(col._id))}
                      />
                      <button
                        onClick={() => addTask(col._id)}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 font-bold"
                        aria-label="Add task"
                      >
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {columns.length === 0 && (
            <div className="w-full flex items-center justify-center py-12 sm:py-20">
              <div className="text-center px-4">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-4 sm:mb-6">
                  <svg
                    className="w-8 h-8 sm:w-12 sm:h-12 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                    />
                  </svg>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
                  No columns yet
                </h3>
                <p className="text-gray-400 text-xs sm:text-sm font-medium">
                  {selectedUserFilter === "all" ? "No tasks yet" : "No tasks for this user"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

       {/* Task Modal */}
      {modalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 sm:p-6 flex items-center justify-between">
              <h2 className="text-lg sm:text-2xl font-bold text-white">Task Details</h2>
              <button
                onClick={closeTaskModal}
                className="p-1.5 sm:p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="space-y-4 sm:space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 border-2 border-gray-200 focus:border-indigo-400 px-3 sm:px-4 py-2 sm:py-3 rounded-xl outline-none transition-all text-base sm:text-lg font-medium"
                    value={modalData.title}
                    onChange={(e) => setModalData({ ...modalData, title: e.target.value })}
                    placeholder="Enter task title"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    className="w-full bg-gray-50 border-2 border-gray-200 focus:border-indigo-400 px-3 sm:px-4 py-2 sm:py-3 rounded-xl outline-none transition-all resize-none text-sm sm:text-base"
                    value={modalData.description}
                    onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
                    placeholder="Add a description..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Priority */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                      Priority
                    </label>
                    <div className="flex gap-1.5 sm:gap-2">
                      {["low", "medium", "high"].map((priority) => (
                        <button
                          key={priority}
                          onClick={() => setModalData({ ...modalData, priority })}
                          className={`flex-1 px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold transition-all text-xs sm:text-sm ${
                            modalData.priority === priority
                              ? priority === "high"
                                ? "bg-red-500 text-white"
                                : priority === "medium"
                                ? "bg-yellow-500 text-white"
                                : "bg-green-500 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      className="w-full bg-gray-50 border-2 border-gray-200 focus:border-indigo-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl outline-none transition-all text-sm sm:text-base"
                      value={modalData.dueDate}
                      onChange={(e) => setModalData({ ...modalData, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* Status / Column Selector */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                    Status
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {columns.map((col, index) => {
                      const columnColors = [
                        { bg: "bg-blue-500", hover: "hover:bg-blue-600", ring: "ring-blue-500" },
                        { bg: "bg-purple-500", hover: "hover:bg-purple-600", ring: "ring-purple-500" },
                        { bg: "bg-emerald-500", hover: "hover:bg-emerald-600", ring: "ring-emerald-500" },
                        { bg: "bg-orange-500", hover: "hover:bg-orange-600", ring: "ring-orange-500" },
                        { bg: "bg-indigo-500", hover: "hover:bg-indigo-600", ring: "ring-indigo-500" },
                      ];
                      const colors = columnColors[index % columnColors.length];
                      
                      return (
                        <button
                          key={col._id}
                          onClick={() => setModalData({ ...modalData, columnId: col._id })}
                          className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl font-semibold transition-all text-white text-xs sm:text-sm ${
                            modalData.columnId === col._id
                              ? `${colors.bg} ring-4 ${colors.ring} ring-opacity-30 scale-105`
                              : `${colors.bg} ${colors.hover} opacity-70 hover:opacity-100`
                          }`}
                        >
                          {col.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Attachments */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                    Attachments
                  </label>
                  
                  {/* File Upload Button */}
                  <div className="mb-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border-2 border-dashed border-indigo-300 hover:border-indigo-400 rounded-xl transition-all text-indigo-700 font-medium text-sm">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span>Attach Files</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileAttach}
                        accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.zip"
                      />
                    </label>
                  </div>

                  {/* Attachments List */}
                  {modalData.attachments && modalData.attachments.length > 0 && (
                    <div className="space-y-2">
                      {modalData.attachments.map((attachment) => {
                        const attachmentKey = attachment._id || attachment.id;
                        const attachmentUrl = attachment._id 
                          ? `${ 'http://localhost:3000/api'}${attachment.url}`
                          : attachment.url;
                        const downloadUrl = attachment._id
                          ? getDownloadUrl(modalTask._id, attachment._id)
                          : attachment.url;
                        
                        return (
                          <div
                            key={attachmentKey}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors group"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {/* File Icon */}
                              <div className="flex-shrink-0">
                                {attachment.type?.startsWith('image/') ? (
                                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200">
                                    <img
                                      src={attachmentUrl}
                                      alt={attachment.originalName || attachment.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              {/* File Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {attachment.originalName || attachment.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(attachment.size)}
                                </p>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <a
                                href={downloadUrl}
                                download={attachment.originalName || attachment.name}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Download file"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </a>
                              <button
                                onClick={() => removeAttachment(attachment)}
                                className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                aria-label="Remove file"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                 {/* USER ASSIGNMENT DROPDOWN - NEW FEATURE */}
                <UserAssignmentDropdown
                  assignedUsers={modalData.assignedTo || []}
                  onAssign={handleAssignUsers}
                  onUnassign={handleUnassignUser}
                />

                {/* Comments Section */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Comments ({modalData.comments?.length || 0})
                  </label>
                  
                  {/* Add Comment Input */}
                  <div className="mb-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-gray-50 border-2 border-gray-200 focus:border-indigo-400 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl outline-none transition-all text-sm placeholder-gray-400"
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, handleAddComment)}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send
                      </button>
                    </div>
                  </div>

                  {/* Comments List */}
                  {modalData.comments && modalData.comments.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                      {modalData.comments.map((comment) => (
                        <div
                          key={comment._id}
                          className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200 hover:border-indigo-200 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-xs font-bold">
                                    {comment.author?.name?.[0]?.toUpperCase() || 'U'}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">
                                    {comment.author?.name || 'User'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatCommentTime(comment.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed break-words">
                                {comment.text}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteComment(comment._id)}
                              className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                              aria-label="Delete comment"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                      <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-sm text-gray-400 font-medium">No comments yet</p>
                      <p className="text-xs text-gray-400 mt-1">Be the first to comment!</p>
                    </div>
                  )}
                </div>

                {/* Task Info */}
                <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Task Information
                  </h3>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div>
                      <p className="text-gray-500">Created</p>
                      <p className="font-medium text-gray-800">
                        {formatDate(modalTask.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Last Updated</p>
                      <p className="font-medium text-gray-800">
                        {formatDate(modalTask.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <button
                onClick={() => {
                  removeTask(modalTask._id);
                  closeTaskModal();
                }}
                className="px-4 sm:px-6 py-2.5 sm:py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base order-2 sm:order-1"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
              <div className="flex gap-2 sm:gap-3 order-1 sm:order-2">
                <button
                  onClick={closeTaskModal}
                  className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-all text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTaskModal}
                  className="flex-1 sm:flex-none px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-sm sm:text-base"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        @media (max-width: 640px) {
          .custom-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .custom-scrollbar::-webkit-scrollbar {
            display: none;
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        
        @media (max-width: 640px) {
          button, input, textarea {
            min-height: 44px;
          }
        }
      `}</style>
    </div>
  );
}