package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"kanban/internal/utils"
)

// ContextUserIDKey is the gin context key holding the authenticated user id.
const ContextUserIDKey = "user_id"

// RequireAuth rejects requests without a valid "Authorization: Bearer <jwt>" header.
func RequireAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			abortUnauthorized(c, "authorization header is required")
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
			abortUnauthorized(c, "authorization header must be 'Bearer <token>'")
			return
		}

		claims, err := utils.ParseToken(strings.TrimSpace(parts[1]), secret)
		if err != nil {
			abortUnauthorized(c, "invalid or expired token")
			return
		}

		c.Set(ContextUserIDKey, claims.UserID)
		c.Next()
	}
}

// UserID returns the authenticated user id (0 when the route is not protected).
func UserID(c *gin.Context) uint {
	return c.GetUint(ContextUserIDKey)
}

func abortUnauthorized(c *gin.Context, message string) {
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"message": message})
}
