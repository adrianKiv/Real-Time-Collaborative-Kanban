package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"kanban/internal/middleware"
	"kanban/internal/models"
	"kanban/internal/service"
	"kanban/internal/utils"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type registerRequest struct {
	Name      string `json:"name" binding:"required,min=2,max=120"`
	Email     string `json:"email" binding:"required,email,max=190"`
	Password  string `json:"password" binding:"required,min=8,max=72"`
	AvatarURL string `json:"avatar_url" binding:"omitempty,url,max=500"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type authResponse struct {
	User  *models.User `json:"user"`
	Token string       `json:"token"`
}

// POST /api/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.FailWithDetails(c, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	user, token, err := h.auth.Register(c.Request.Context(), req.Name, req.Email, req.Password, req.AvatarURL)
	if err != nil {
		if errors.Is(err, service.ErrEmailExists) {
			utils.Fail(c, http.StatusConflict, err.Error())
			return
		}
		utils.Fail(c, http.StatusInternalServerError, "failed to register user")
		return
	}

	utils.Created(c, authResponse{User: user, Token: token})
}

// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.FailWithDetails(c, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	user, token, err := h.auth.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			utils.Fail(c, http.StatusUnauthorized, err.Error())
			return
		}
		utils.Fail(c, http.StatusInternalServerError, "failed to login")
		return
	}

	utils.OK(c, authResponse{User: user, Token: token})
}

// GET /api/auth/me (protected)
func (h *AuthHandler) Me(c *gin.Context) {
	user, err := h.auth.Profile(c.Request.Context(), middleware.UserID(c))
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			utils.Fail(c, http.StatusNotFound, err.Error())
			return
		}
		utils.Fail(c, http.StatusInternalServerError, "failed to load profile")
		return
	}

	utils.OK(c, gin.H{"user": user})
}
