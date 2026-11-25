package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"kanban/internal/middleware"
	"kanban/internal/service"
	"kanban/internal/utils"
)

type ColumnHandler struct {
	columns *service.ColumnService
}

func NewColumnHandler(columns *service.ColumnService) *ColumnHandler {
	return &ColumnHandler{columns: columns}
}

type columnTitleRequest struct {
	Title string `json:"title" binding:"required,max=160"`
}

type moveColumnRequest struct {
	NewPosition *float64 `json:"new_position" binding:"required"`
}

// POST /api/boards/:id/columns
func (h *ColumnHandler) Create(c *gin.Context) {
	boardID, ok := paramID(c, "id")
	if !ok {
		return
	}

	var req columnTitleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.FailWithDetails(c, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	column, err := h.columns.Create(c.Request.Context(), middleware.UserID(c), boardID, req.Title)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	utils.Created(c, gin.H{"column": column})
}

// PUT /api/columns/:id
func (h *ColumnHandler) Update(c *gin.Context) {
	columnID, ok := paramID(c, "id")
	if !ok {
		return
	}

	var req columnTitleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.FailWithDetails(c, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	column, err := h.columns.Update(c.Request.Context(), middleware.UserID(c), columnID, req.Title)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	utils.OK(c, gin.H{"column": column})
}

// PATCH /api/columns/:id/move
func (h *ColumnHandler) Move(c *gin.Context) {
	columnID, ok := paramID(c, "id")
	if !ok {
		return
	}

	var req moveColumnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.FailWithDetails(c, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}
	column, err := h.columns.Move(c.Request.Context(), middleware.UserID(c), columnID, *req.NewPosition)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	utils.OK(c, gin.H{"column": column})
}

// DELETE /api/columns/:id
func (h *ColumnHandler) Delete(c *gin.Context) {
	columnID, ok := paramID(c, "id")
	if !ok {
		return
	}

	if err := h.columns.Delete(c.Request.Context(), middleware.UserID(c), columnID); err != nil {
		respondServiceError(c, err)
		return
	}
	utils.OK(c, gin.H{"deleted_column_id": columnID})
}
