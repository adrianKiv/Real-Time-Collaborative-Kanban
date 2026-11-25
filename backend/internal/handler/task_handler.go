package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"kanban/internal/middleware"
	"kanban/internal/service"
	"kanban/internal/utils"
)

type TaskHandler struct {
	tasks *service.TaskService
}

func NewTaskHandler(tasks *service.TaskService) *TaskHandler {
	return &TaskHandler{tasks: tasks}
}

type createTaskRequest struct {
	Title       string     `json:"title" binding:"required,max=200"`
	Description string     `json:"description" binding:"omitempty,max=5000"`
	Priority    string     `json:"priority" binding:"omitempty,oneof=low medium high"`
	AssigneeID  *uint      `json:"assignee_id"`
	DueDate     *time.Time `json:"due_date"`
}

type updateTaskRequest struct {
	Title       *string    `json:"title"`
	Description *string    `json:"description"`
	Priority    *string    `json:"priority" binding:"omitempty,oneof=low medium high"`
	AssigneeID  *uint      `json:"assignee_id"`
	DueDate     *time.Time `json:"due_date"`
}

type moveTaskRequest struct {
	ToColumnID  uint    `json:"to_column_id" binding:"required"`
	NewPosition float64 `json:"new_position"`
}

// POST /api/columns/:id/tasks
func (h *TaskHandler) Create(c *gin.Context) {
	columnID, ok := paramID(c, "id")
	if !ok {
		return
	}

	var req createTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.FailWithDetails(c, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	task, err := h.tasks.Create(c.Request.Context(), middleware.UserID(c), columnID, service.CreateTaskInput{
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
		AssigneeID:  req.AssigneeID,
		DueDate:     req.DueDate,
	})
	if err != nil {
		respondServiceError(c, err)
		return
	}
	utils.Created(c, gin.H{"task": task})
}

// PUT /api/tasks/:id
func (h *TaskHandler) Update(c *gin.Context) {
	taskID, ok := paramID(c, "id")
	if !ok {
		return
	}

	var req updateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.FailWithDetails(c, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	task, err := h.tasks.Update(c.Request.Context(), middleware.UserID(c), taskID, service.UpdateTaskInput{
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
		AssigneeID:  req.AssigneeID,
		DueDate:     req.DueDate,
	})
	if err != nil {
		respondServiceError(c, err)
		return
	}
	utils.OK(c, gin.H{"task": task})
}

// DELETE /api/tasks/:id
func (h *TaskHandler) Delete(c *gin.Context) {
	taskID, ok := paramID(c, "id")
	if !ok {
		return
	}

	if err := h.tasks.Delete(c.Request.Context(), middleware.UserID(c), taskID); err != nil {
		respondServiceError(c, err)
		return
	}
	utils.OK(c, gin.H{"deleted_task_id": taskID})
}

// PATCH /api/tasks/:id/move
func (h *TaskHandler) Move(c *gin.Context) {
	taskID, ok := paramID(c, "id")
	if !ok {
		return
	}

	var req moveTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.FailWithDetails(c, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	task, err := h.tasks.Move(c.Request.Context(), middleware.UserID(c), taskID, req.ToColumnID, req.NewPosition)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	utils.OK(c, gin.H{"task": task})
}
