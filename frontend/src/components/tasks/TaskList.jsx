import React, { useState, useEffect, useCallback } from "react";
import {
  TrashIcon,
  ChevronDownIcon,
  SparklesIcon,
  ClockIcon,
  FlagIcon,
  MapIcon,
  CheckCircleIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../contexts/AuthContext";
import GroupTaskDisplay from "./GroupTaskDisplay";

const TaskList = ({
  tasks,
  loading,
  onTaskDeleted,
  onRefresh,
  onTaskUpdated,
}) => {
  const { user } = useAuth();
  const [expandedTask, setExpandedTask] = useState(null);
  const [optimisticTasks, setOptimisticTasks] = useState([]);
  const [pendingUpdates, setPendingUpdates] = useState(new Set());
  const [groupMembers, setGroupMembers] = useState([]);

  // Sync optimistic tasks with actual tasks
  useEffect(() => {
    setOptimisticTasks(tasks);
  }, [tasks]);

  // Fetch group members for task assignment
  useEffect(() => {
    fetchGroupMembers();
  }, []);

  const fetchGroupMembers = async () => {
    try {
      const response = await fetch('/api/groups/current', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success && data.group && data.group.members) {
        setGroupMembers(data.group.members);
      }
    } catch (error) {
      console.error('Error fetching group members:', error);
    }
  };

  // Helper function to check if task is assigned to current user
  const isTaskAssignedToMe = (task) => {
    if (!user || !user._id) return false;
    
    const currentUserId = user._id;
    
    // Check direct assignment
    if (task.assignedTo === currentUserId) {
      return true;
    }
    
    // Check header assignments in group tasks
    if (task.isGroupTask && task.taskHeaders) {
      return task.taskHeaders.some(header => header.assignedTo === currentUserId);
    }
    
    return false;
  };

  const handleRoadmapItemToggle = useCallback(
    async (taskId, itemIndex, currentStatus) => {
      const newStatus = !currentStatus;
      const updateKey = `${taskId}-${itemIndex}`;
      if (pendingUpdates.has(updateKey)) {
        return;
      }
      setPendingUpdates((prev) => new Set(prev).add(updateKey));
      setOptimisticTasks((prevTasks) =>
        prevTasks.map((task) => {
          if (task._id === taskId) {
            if (!task.roadmapItems || !Array.isArray(task.roadmapItems)) {
              console.warn(
                "Invalid roadmapItems structure for task:",
                task.title
              );
              return task;
            }
            if (itemIndex < 0 || itemIndex >= task.roadmapItems.length) {
              console.warn(
                "Invalid itemIndex:",
                itemIndex,
                "for task:",
                task.title
              );
              return task;
            }
            const updatedRoadmapItems = [...task.roadmapItems];
            updatedRoadmapItems[itemIndex] = {
              ...updatedRoadmapItems[itemIndex],
              completed: newStatus,
            };
            const completedItems = updatedRoadmapItems.filter(
              (item) => item.completed
            ).length;
            const totalItems = updatedRoadmapItems.length;
            const newProgress =
              totalItems > 0
                ? Math.round((completedItems / totalItems) * 100)
                : 0;
            return {
              ...task,
              roadmapItems: updatedRoadmapItems,
              overallProgress: newProgress,
              completed: newProgress === 100,
            };
          }
          return task;
        })
      );
      try {
        const response = await fetch(
          `/api/ai/tasks/${taskId}/roadmap/${itemIndex}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ completed: newStatus }),
          }
        );
        const data = await response.json();
        if (data.success) {
          if (onTaskUpdated) {
            try {
              onTaskUpdated(data.data.task);
            } catch (error) {
              console.error("Error in onTaskUpdated callback:", error);
            }
          }
        } else {
          setOptimisticTasks(tasks);
        }
      } catch (error) {
        console.error("Error updating roadmap item:", error);
        setOptimisticTasks(tasks);
      } finally {
        setPendingUpdates((prev) => {
          const newSet = new Set(prev);
          newSet.delete(updateKey);
          return newSet;
        });
      }
    },
    [onTaskUpdated, tasks, pendingUpdates]
  );

  const handleDelete = async (taskId) => {
    try {
      const response = await fetch(`/api/ai/tasks/${taskId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        onTaskDeleted(taskId);
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "from-red-500 to-orange-500";
      case "medium":
        return "from-yellow-500 to-amber-500";
      case "low":
        return "from-green-500 to-emerald-500";
      default:
        return "from-gray-500 to-slate-500";
    }
  };

  const tasksToRender = optimisticTasks;

  // Don't render until user is loaded to prevent assignment check errors
  if (!user) {
    return (
      <div className="bg-indigo-400/10 shadow-[0_0_40px_10px_rgba(99,102,241,0.15)] rounded-2xl h-full flex flex-col">
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-indigo-400/10 shadow-[0_0_40px_10px_rgba(99,102,241,0.15)] rounded-2xl h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 backdrop-blur-sm border border-indigo-500/30 rounded-t-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-8 h-8 text-indigo-400" />
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Task Management
              </h2>
              <p className="text-sm text-gray-400">
                {tasksToRender.length} active tasks
                {pendingUpdates.size > 0 && (
                  <span className="ml-2 text-yellow-400">
                    ({pendingUpdates.size} updating...)
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="text-indigo-400 hover:text-indigo-300 transition-colors hover:scale-105"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Task List */}
      <div className="flex-1 bg-black/20 backdrop-blur-sm border-x border-indigo-500/30 overflow-y-auto scrollbar-none hide-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : tasksToRender.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <SparklesIcon className="w-16 h-16 text-purple-400/50 mb-4" />
            <p className="text-gray-400 text-lg mb-2">No tasks yet</p>
            <p className="text-gray-500 text-sm">
              Create your first task to get started!
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {tasksToRender.map((task) => {
              try {
                // Validate task structure
                if (!task || !task._id) {
                  console.warn("Invalid task structure:", task);
                  return null;
                }
                return (
                  <div key={task._id} className="group">
                  <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-600/30 rounded-xl p-4 hover:border-purple-500/50 transition-all duration-300">
                    {/* Task Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-white text-lg">
                            {task.title}
                          </h3>
                          {task.aiGenerated ? (
                            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                              AI
                            </div>
                          ) : (
                            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs px-2 py-1 rounded-full">
                              Manual
                            </div>
                          )}
                          {task.isGroupTask && (
                            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zM4 18v-4h2v4h12v-4h2v4c0 1.11-.89 2-2 2H6c-1.11 0-2-.89-2-2z"/>
                                <path d="M12.5 11.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S11 9.17 11 10s.67 1.5 1.5 1.5z"/>
                                <path d="M6.5 11.5c.83 0 1.5-.67 1.5-1.5S7.33 8.5 6.5 8.5 5 9.17 5 10s.67 1.5 1.5 1.5z"/>
                              </svg>
                              <span>Group</span>
                            </div>
                          )}
                          {task.createdBy && (
                            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <UserIcon className="w-3 h-3" />
                              <span>by {task.createdBy.username}</span>
                            </div>
                          )}
                          {(() => {
                            try {
                              return isTaskAssignedToMe(task) && (
                                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                  </svg>
                                  <span>Assigned</span>
                                </div>
                              );
                            } catch (error) {
                              console.error('Error checking task assignment:', error);
                              return null;
                            }
                          })()}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                          <div className="flex items-center gap-1">
                            <FlagIcon className="w-4 h-4" />
                            <span
                              className={`bg-gradient-to-r ${getPriorityColor(
                                task.priority
                              )} bg-clip-text text-transparent font-medium`}
                            >
                              {task.priority}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ClockIcon className="w-4 h-4" />
                            <span>{task.duration}</span>
                          </div>
                          {task.roadmapItems?.length > 0 && (
                            <div className="flex items-center gap-1">
                              <MapIcon className="w-4 h-4" />
                              <span>{task.roadmapItems.length} items</span>
                            </div>
                          )}
                        </div>
                        {/* Progress Bar */}
                        {task.roadmapItems && task.roadmapItems.length > 0 && (
                          <div className="mb-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-gray-400">
                                Progress
                              </span>
                              <span className="text-xs text-gray-400">
                                {task.overallProgress || 0}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                                style={{
                                  width: `${task.overallProgress || 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                        {/* Group Task Assignments */}
                        {task.isGroupTask && task.taskHeaders && task.taskHeaders.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center gap-1 mb-1">
                              <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zM4 18v-4h2v4h12v-4h2v4c0 1.11-.89 2-2 2H6c-1.11 0-2-.89-2-2z"/>
                              </svg>
                              <span className="text-xs text-gray-400">
                                Assignments
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {task.taskHeaders.map((header, index) => {
                                const assignedMember = groupMembers.find(member => member._id === header.assignedTo);
                                return (
                                  <div 
                                    key={index} 
                                    className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${
                                      header.assignedTo === user._id
                                        ? 'bg-orange-500/20 border-orange-500/30 text-orange-300'
                                        : assignedMember
                                        ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                                        : 'bg-gray-500/20 border-gray-500/30 text-gray-400'
                                    }`}
                                  >
                                    <div className="w-1.5 h-1.5 bg-current rounded-full"></div>
                                    <span className="truncate max-w-20">
                                      {header.title}: {assignedMember?.username || 'Unassigned'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setExpandedTask(
                              expandedTask === task._id ? null : task._id
                            )
                          }
                          className="text-gray-400 hover:text-purple-400 transition-colors hover:scale-105"
                        >
                          <ChevronDownIcon
                            className={`w-5 h-5 transition-transform duration-300 ${
                              expandedTask === task._id ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => handleDelete(task._id)}
                          className="text-gray-400 hover:text-red-400 transition-colors hover:scale-105"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Interactive Roadmap Items Section */}
                    {task.roadmapItems && Array.isArray(task.roadmapItems) && task.roadmapItems.length > 0 && (
                      <div className="mb-3">
                        <div className="space-y-2">
                          {task.roadmapItems
                            .slice(0, expandedTask === task._id ? task.roadmapItems.length : 3)
                            .map((item, displayIndex) => {
                              const updateKey = `${task._id}-${displayIndex}`;
                              const isPending = pendingUpdates.has(updateKey);

                              // Validate item structure
                              if (!item || typeof item.text !== 'string') {
                                console.warn("Invalid roadmap item:", item, "for task:", task.title);
                                return null;
                              }

                              return (
                                <div
                                  key={`${task._id}-${displayIndex}`}
                                  className="flex items-center gap-3 p-2 rounded hover:bg-slate-600/20 transition-colors duration-200"
                                >
                                  <button
                                    onClick={() => handleRoadmapItemToggle(task._id, displayIndex, item.completed)}
                                    disabled={isPending}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                                      item.completed
                                        ? "bg-purple-500 border-purple-500 scale-110"
                                        : "border-gray-400 hover:border-purple-400 hover:scale-105"
                                    } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {item.completed && (
                                      <CheckCircleIcon className="w-3 h-3 text-white" />
                                    )}
                                  </button>
                                  <span
                                    className={`text-sm flex-1 transition-all duration-300 ${
                                      item.completed
                                        ? "text-gray-400 line-through"
                                        : "text-gray-300"
                                    } ${isPending ? 'opacity-70' : ''}`}
                                  >
                                    {item.text}
                                    {isPending && (
                                      <span className="ml-2 text-yellow-400 text-xs">
                                        ⏳
                                      </span>
                                    )}
                                  </span>
                                </div>
                              );
                            })}

                          {/* Show more button if there are more than 3 items */}
                          {task.roadmapItems.length > 3 && expandedTask !== task._id && (
                            <button
                              onClick={() => setExpandedTask(task._id)}
                              className="text-purple-400 text-sm hover:text-purple-300 transition-colors duration-200"
                            >
                              +{task.roadmapItems.length - 3} more items...
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Expanded Content */}
                    {expandedTask === task._id && (
                      <div className="border-t border-gray-600/30 pt-3 mt-3 space-y-4 animate-in slide-in-from-top-2 duration-300">
                        {task.description && (
                          <div>
                            <h4 className="text-purple-400 font-medium mb-2">
                              Description
                            </h4>
                            <p className="text-gray-300 text-sm">
                              {task.description}
                            </p>
                          </div>
                        )}
                        {/* Milestones */}
                        {task.milestones && task.milestones.length > 0 && (
                          <div>
                            <h4 className="text-purple-400 font-medium mb-2">
                              Milestones
                            </h4>
                            <div className="space-y-2">
                              {task.milestones.map((milestone, idx) => (
                                <div
                                  key={idx}
                                  className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/20 flex items-center gap-3"
                                >
                                  <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"></div>
                                  <div className="flex-1">
                                    <p className="text-white font-medium text-sm">
                                      {milestone.title}
                                    </p>
                                    {milestone.dueDate && (
                                      <p className="text-gray-400 text-xs mt-1">
                                        Due:{" "}
                                        {new Date(
                                          milestone.dueDate
                                        ).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Resources Section */}
                        {task.resources && (task.resources.free?.length > 0 || task.resources.paid?.length > 0) && (
                          <div>
                            <h4 className="text-purple-400 font-medium mb-3">
                              📚 Learning Resources
                            </h4>
                            {console.log('Rendering resources for task:', task.title, task.resources)}
                            
                            {/* Free Resources */}
                            {task.resources.free && task.resources.free.length > 0 && (
                              <div className="mb-4">
                                <h5 className="text-green-400 font-medium mb-2 text-sm flex items-center gap-2">
                                  🆓 Free Resources
                                </h5>
                                <div className="space-y-2">
                                  {task.resources.free.map((resource, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-slate-700/20 rounded-lg p-3 border border-green-500/20 hover:border-green-400/40 transition-colors"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                          <a
                                            href={resource.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-white font-medium text-sm hover:text-green-400 transition-colors cursor-pointer underline hover:no-underline"
                                            onClick={(e) => {
                                              console.log('Clicking resource:', resource.url);
                                              // Ensure the click event propagates
                                              e.stopPropagation();
                                            }}
                                          >
                                            {resource.title}
                                          </a>
                                          {resource.description && (
                                            <p className="text-gray-400 text-xs mt-1">
                                              {resource.description}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-xs px-2 py-1 rounded-full ${
                                            resource.platform === 'GeeksForGeeks' 
                                              ? 'bg-green-600/30 text-green-300' 
                                              : 'bg-purple-600/30 text-purple-300'
                                          }`}>
                                            {resource.platform}
                                          </span>
                                          {resource.description?.includes('Updated working link') && (
                                            <span className="text-xs px-1 py-0.5 bg-yellow-600/30 text-yellow-300 rounded">
                                              ✓ Verified
                                            </span>
                                          )}
                                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Paid Resources */}
                            {task.resources.paid && task.resources.paid.length > 0 && (
                              <div>
                                <h5 className="text-yellow-400 font-medium mb-2 text-sm flex items-center gap-2">
                                  💰 Premium Resources
                                </h5>
                                <div className="space-y-2">
                                  {task.resources.paid.map((resource, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-slate-700/20 rounded-lg p-3 border border-yellow-500/20 hover:border-yellow-400/40 transition-colors"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                          <a
                                            href={resource.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-white font-medium text-sm hover:text-yellow-400 transition-colors cursor-pointer underline hover:no-underline"
                                            onClick={(e) => {
                                              console.log('Clicking paid resource:', resource.url);
                                              e.stopPropagation();
                                            }}
                                          >
                                            {resource.title}
                                          </a>
                                          {resource.description && (
                                            <p className="text-gray-400 text-xs mt-1">
                                              {resource.description}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs px-2 py-1 rounded-full bg-yellow-600/30 text-yellow-300">
                                            {resource.platform}
                                          </span>
                                          {resource.description?.includes('Updated working link') && (
                                            <span className="text-xs px-1 py-0.5 bg-green-600/30 text-green-300 rounded">
                                              ✓ Verified
                                            </span>
                                          )}
                                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Group Task Structure */}
                        {task.isGroupTask && (
                          <GroupTaskDisplay 
                            task={task}
                            groupMembers={groupMembers}
                            onTaskUpdated={onTaskUpdated}
                            onAssignmentChanged={onTaskUpdated}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
              } catch (error) {
                console.error('Error rendering task:', task?._id || 'unknown', error);
                return (
                  <div key={task?._id || Math.random()} className="group">
                    <div className="bg-red-800/20 border border-red-500/30 rounded-xl p-4">
                      <p className="text-red-400 text-sm">Error displaying task</p>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 backdrop-blur-sm border border-indigo-500/30 rounded-b-2xl p-4">
        <div className="text-center text-sm text-gray-400">
          ✨ Organize your productivity journey ✨
        </div>
      </div>
    </div>
  );
};

export default TaskList;