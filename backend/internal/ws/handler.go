package ws

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"kanban/internal/repository"
	"kanban/internal/utils"
)

// Handler upgrades authenticated, authorised HTTP requests to websockets.
type Handler struct {
	hub       *Hub
	boards    repository.BoardRepository
	jwtSecret string
	upgrader  websocket.Upgrader
}

func NewHandler(hub *Hub, boards repository.BoardRepository, jwtSecret string, allowedOrigins []string) *Handler {
	return &Handler{
		hub:       hub,
		boards:    boards,
		jwtSecret: jwtSecret,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin:     originChecker(allowedOrigins),
		},
	}
}

// ServeWS handles GET /ws/boards/:id?token=<jwt>.
// The token is validated and board membership is checked *before* the upgrade,
// so unauthorised clients get a normal JSON error instead of a socket.
func (h *Handler) ServeWS(c *gin.Context) {
	boardID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || boardID == 0 {
		utils.Fail(c, http.StatusBadRequest, "invalid id parameter")
		return
	}

	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		utils.Fail(c, http.StatusUnauthorized, "token query parameter is required")
		return
	}

	claims, err := utils.ParseToken(token, h.jwtSecret)
	if err != nil {
		utils.Fail(c, http.StatusUnauthorized, "invalid or expired token")
		return
	}

	ctx := c.Request.Context()
	if _, err := h.boards.FindMember(ctx, uint(boardID), claims.UserID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			exists, existsErr := h.boards.Exists(ctx, uint(boardID))
			if existsErr != nil {
				utils.Fail(c, http.StatusInternalServerError, "internal server error")
				return
			}
			if !exists {
				utils.Fail(c, http.StatusNotFound, "board not found")
				return
			}
			utils.Fail(c, http.StatusForbidden, "you do not have access to this board")
			return
		}
		utils.Fail(c, http.StatusInternalServerError, "internal server error")
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		// Upgrade already produced the HTTP error response.
		return
	}

	client := NewClient(h.hub, conn, uint(boardID), claims.UserID)
	h.hub.Join(client)
	go client.WritePump()
	client.ReadPump() // blocks until the peer disconnects; gin runs each request in its own goroutine
}

// originChecker mirrors the REST CORS policy for the upgrade handshake.
func originChecker(allowedOrigins []string) func(*http.Request) bool {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	allowAll := false
	for _, origin := range allowedOrigins {
		origin = strings.TrimRight(strings.TrimSpace(origin), "/")
		if origin == "*" {
			allowAll = true
			continue
		}
		if origin != "" {
			allowed[origin] = struct{}{}
		}
	}

	return func(r *http.Request) bool {
		origin := strings.TrimRight(r.Header.Get("Origin"), "/")
		if origin == "" {
			return true // non-browser client (curl, tests, native app)
		}
		if allowAll {
			return true
		}
		_, ok := allowed[origin]
		return ok
	}
}
