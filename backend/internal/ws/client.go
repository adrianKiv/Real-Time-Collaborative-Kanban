package ws

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// writeWait is the time allowed to write one message to the peer.
	writeWait = 10 * time.Second
	// pongWait is how long we wait for a pong before considering the peer dead.
	pongWait = 60 * time.Second
	// pingPeriod must be smaller than pongWait.
	pingPeriod = (pongWait * 9) / 10
	// maxMessageSize caps inbound frames (the API only reads pongs/closes).
	maxMessageSize = 4096
	// sendBuffer is the per-client outbound queue.
	sendBuffer = 256
)

// Client is one websocket connection inside a board room.
// All writes happen in WritePump; Close is idempotent and safe from any goroutine.
type Client struct {
	hub     *Hub
	conn    *websocket.Conn
	boardID uint
	userID  uint
	send    chan []byte
	done    chan struct{}
	once    sync.Once
}

func NewClient(hub *Hub, conn *websocket.Conn, boardID, userID uint) *Client {
	return &Client{
		hub:     hub,
		conn:    conn,
		boardID: boardID,
		userID:  userID,
		send:    make(chan []byte, sendBuffer),
		done:    make(chan struct{}),
	}
}

func (c *Client) UserID() uint  { return c.userID }
func (c *Client) BoardID() uint { return c.boardID }

// Close closes the connection exactly once. The send channel is intentionally
// never closed, so a broadcast racing with a disconnect cannot panic.
func (c *Client) Close() {
	c.once.Do(func() {
		close(c.done)
		_ = c.conn.Close()
	})
}

// ReadPump drains inbound frames (only pings/pongs/close matter), refreshes the
// read deadline on pong and tears the client down when the peer goes away.
func (c *Client) ReadPump() {
	defer func() {
		c.hub.Leave(c)
		c.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	_ = c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			return
		}
		// Mutations arrive over REST; inbound payloads are ignored.
	}
}

// WritePump serialises all outbound writes: room events plus ping heartbeats.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Close()
	}()

	for {
		select {
		case <-c.done:
			return

		case msg := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
