package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"kanban/internal/middleware"
	"kanban/internal/service"
	"kanban/internal/utils"
)

type BoardHandler struct {
	boards *service.BoardService
}

func NewBoardHandler(boards *service.BoardService) *BoardHandler {
	return &BoardHandler{boards: boards}
}

type createBoardRequest struct {
	Title       string `json:"title" binding:"required,max=160"`
	Description string `json:"description" binding:"omitempty,max=2000"`
}

type inviteMemberRequest struct {
	Email string `json:"email" binding:"required,email,max=190"`
}

// GET /api/boards
func (h *BoardHandler) List(c *gin.Context) {
	boards, err := h.boards.List(c.Request.Context(), middleware.UserID(c))
	if err != nil {
		respondServiceError(c, err)
		return
	}
	utils.OK(c, gin.H{"boards": boards})
}

// POST /api/boards
func (h *BoardHandler) Create(c *gin.Context) {
	var req createBoardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.FailWithDetails(c, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	board, err := h.boards.Create(c.Request.Context(), middleware.UserID(c), service.CreateBoardInput{
		Title:       req.Title,
		Description: req.Description,
	})
	if err != nil {
		respondServiceError(c, err)
		return
	}
	utils.Created(c, gin.H{"board": board})
}

// GET /api/boards/:id
func (h *BoardHandler) Get(c *gin.Context) {
	boardID, ok := paramID(c, "id")
	if !ok {
		return
	}

	board, err := h.boards.Get(c.Request.Context(), middleware.UserID(c), boardID)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	utils.OK(c, gin.H{"board": board})
}

// PUT /api/boards/:id
func (h *BoardHandler) Update(c *gin.Context) {
	boardID, ok := paramID(c, "id")
	if !ok {
		return
	}

	var req createBoardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.FailWithDetails(c, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	board, err := h.boards.Update(c.Request.Context(), middleware.UserID(c), boardID, service.CreateBoardInput{
		Title:       req.Title,
		Description: req.Description,
	})
	if err != nil {
		respondServiceError(c, err)
		return
	}
	utils.OK(c, gin.H{"board": board})
}

// DELETE /api/boards/:id
func (h *BoardHandler) Delete(c *gin.Context) {
	boardID, ok := paramID(c, "id")
	if !ok {
		return
	}

	if err := h.boards.Delete(c.Request.Context(), middleware.UserID(c), boardID); err != nil {
		respondServiceError(c, err)
		return
	}
	utils.OK(c, gin.H{"deleted_board_id": boardID})
}

// POST /api/boards/:id/members
func (h *BoardHandler) AddMember(c *gin.Context) {
	boardID, ok := paramID(c, "id")
	if !ok {
		return
	}

	var req inviteMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.FailWithDetails(c, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	member, err := h.boards.AddMember(c.Request.Context(), middleware.UserID(c), boardID, req.Email)
	if err != nil {
		respondServiceError(c, err)
		return
	}
	utils.Created(c, gin.H{"member": member})
}
