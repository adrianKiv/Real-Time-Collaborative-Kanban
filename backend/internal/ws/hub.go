package ws

import (
	"encoding/json"
	"sync"
)

// Broadcast event names.
const (
	EventBoardUpdated  = "BOARD_UPDATED"
	EventBoardDeleted  = "BOARD_DELETED"
	EventColumnCreated = "COLUMN_CREATED"
	EventColumnUpdated = "COLUMN_UPDATED"
	EventColumnDeleted = "COLUMN_DELETED"
	EventColumnMoved   = "COLUMN_MOVED"
	EventTaskCreated   = "TASK_CREATED"
	EventTaskUpdated   = "TASK_UPDATED"
	EventTaskDeleted   = "TASK_DELETED"
	EventTaskMoved     = "TASK_MOVED"
	EventMemberAdded   = "MEMBER_ADDED"
)

// Event is the envelope pushed to every client of a board room.
type Event struct {
	Event    string `json:"event"`
	Payload  any    `json:"payload"`
	SenderID uint   `json:"sender_id"`
}

// Hub owns the board rooms and fans events out to their clients.
// sendBuffer/drop policy: slow clients are disconnected, never blocking a room.
type Hub struct {
	mu    sync.RWMutex
	rooms map[uint]map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{rooms: make(map[uint]map[*Client]bool)}
}

// Join registers a client in its board room. Safe to call concurrently.
func (h *Hub) Join(c *Client) {
	if c == nil {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if h.rooms[c.boardID] == nil {
		h.rooms[c.boardID] = make(map[*Client]bool)
	}
	h.rooms[c.boardID][c] = true
}

// Leave removes a client from its room; idempotent, so ReadPump/WritePump can
// both call it while disconnecting.
func (h *Hub) Leave(c *Client) {
	if c == nil {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	clients, ok := h.rooms[c.boardID]
	if !ok {
		return
	}
	if _, ok := clients[c]; !ok {
		return
	}

	delete(clients, c)
	if len(clients) == 0 {
		delete(h.rooms, c.boardID)
	}
}

// Broadcast marshals once and queues the message for every client in the room.
// The client snapshot is taken under RLock so a disconnect mid-loop is harmless.
func (h *Hub) Broadcast(boardID uint, evt Event) {
	msg, err := json.Marshal(evt)
	if err != nil {
		return
	}

	h.mu.RLock()
	clients := make([]*Client, 0, len(h.rooms[boardID]))
	for c := range h.rooms[boardID] {
		clients = append(clients, c)
	}
	h.mu.RUnlock()

	for _, c := range clients {
		select {
		case c.send <- msg:
		default:
			// Slow consumer: drop it instead of stalling the room.
			c.Close()
		}
	}
}

// RoomSize reports the number of connected clients of a board.
func (h *Hub) RoomSize(boardID uint) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.rooms[boardID])
}
