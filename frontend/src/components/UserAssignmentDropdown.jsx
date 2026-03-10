// UserAssignmentDropdown.jsx - Reusable component for assigning users to tasks

import { useState, useEffect, useRef } from 'react';
import { getAllUsers } from '../services/user.service';

export default function UserAssignmentDropdown({ assignedUsers = [], onAssign, onUnassign }) {
  const [isOpen, setIsOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Load all users when component mounts
    const loadUsers = async () => {
      try {
        setLoading(true);
        const response = await getAllUsers();
        setAllUsers(response.data.data || []);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get user initials for avatar
  const getUserInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Filter users based on search query
  const filteredUsers = allUsers.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  // Get assigned user IDs for quick lookup
  const assignedUserIds = new Set(assignedUsers.map(u => u._id));

  // Handle assign/unassign
  const handleUserClick = (user) => {
    if (assignedUserIds.has(user._id)) {
      onUnassign(user._id);
    } else {
     onAssign(user);

    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
        Assigned To
      </label>

      {/* Assigned Users Display */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {assignedUsers.length > 0 ? (
          assignedUsers.map((user) => (
            <div
              key={user._id}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm group hover:bg-indigo-200 transition-colors"
            >
              <div className="w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {getUserInitials(user.name)}
              </div>
              <span className="font-medium">{user.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnassign(user._id);
                }}
                className="ml-1 hover:text-indigo-900 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove ${user.name}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        ) : (
          <span className="text-sm text-gray-400 italic">No one assigned</span>
        )}
      </div>

      {/* Add User Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 hover:border-indigo-400 rounded-xl text-left flex items-center justify-between transition-all text-sm"
      >
        <span className="text-gray-600 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Assign user
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
              autoFocus
            />
          </div>

          {/* User List */}
          <div className="overflow-y-auto max-h-48">
            {loading ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                Loading users...
              </div>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const isAssigned = assignedUserIds.has(user._id);
                return (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => handleUserClick(user)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${
                      isAssigned ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                      isAssigned ? 'bg-indigo-500' : 'bg-gray-400'
                    }`}>
                      {getUserInitials(user.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        isAssigned ? 'text-indigo-700' : 'text-gray-800'
                      }`}>
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    {isAssigned && (
                      <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchQuery ? 'No users found' : 'No users available'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}