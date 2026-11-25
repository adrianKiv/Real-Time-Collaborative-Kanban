package handler

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"kanban/internal/service"
	"kanban/internal/utils"
)

// paramID parses a positive :id path parameter, answering 400 on failure.
func paramID(c *gin.Context, name string) (uint, bool) {
	raw := c.Param(name)
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || id == 0 {
		utils.Fail(c, http.StatusBadRequest, "invalid "+name+" parameter")
		return 0, false
	}
	return uint(id), true
}

// respondServiceError maps service/domain errors onto HTTP status codes.
func respondServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrBoardNotFound),
		errors.Is(err, service.ErrColumnNotFound),
		errors.Is(err, service.ErrTaskNotFound),
		errors.Is(err, service.ErrMemberNotFound):
		utils.Fail(c, http.StatusNotFound, err.Error())

	case errors.Is(err, service.ErrForbidden),
		errors.Is(err, service.ErrNotBoardAdmin),
		errors.Is(err, service.ErrAssigneeNotMember):
		utils.Fail(c, http.StatusForbidden, err.Error())

	case errors.Is(err, service.ErrAlreadyMember),
		errors.Is(err, service.ErrColumnBoardMismatch):
		utils.Fail(c, http.StatusConflict, err.Error())

	case errors.Is(err, service.ErrTitleRequired),
		errors.Is(err, service.ErrInvalidPrior),
		errors.Is(err, service.ErrInvalidPosition):
		utils.Fail(c, http.StatusBadRequest, err.Error())

	default:
		log.Printf("internal error: %v", err)
		utils.Fail(c, http.StatusInternalServerError, "internal server error")
	}
}
