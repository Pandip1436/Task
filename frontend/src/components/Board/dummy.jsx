//   const logActivity = useCallback(async (type, message, entityType = null, entityId = null) => {
//     const tempId = `temp-${Date.now()}`;
//     const tempEntry = {
//       _id:       tempId,
//       type,
//       message,
//       createdAt: new Date().toISOString(),
//       user:      JSON.parse(localStorage.getItem("user") || "{}"),
//     };
//     setActivityLog(prev => [tempEntry, ...prev]);
//     try {
//       const response = await createActivityLog({ boardId, type, message, entityType, entityId });
//       const saved = response.data;
//       setActivityLog(prev => prev.map(e => e._id === tempId ? saved : e));
//     } catch (err) {
//       console.error("Failed to log activity:", err);
//       setActivityLog(prev => prev.filter(e => e._id !== tempId));
//     }
//   }, [boardId]);