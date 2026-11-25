package utils

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// OK writes a 200 response with the standard {"data": ...} envelope.
func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// Created writes a 201 response with the standard envelope.
func Created(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, gin.H{"data": data})
}

// Fail writes {"error": message} with the given status.
func Fail(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}

// FailWithDetails adds a machine readable detail payload next to the error.
func FailWithDetails(c *gin.Context, status int, message string, details any) {
	c.JSON(status, gin.H{"error": message, "details": details})
}
