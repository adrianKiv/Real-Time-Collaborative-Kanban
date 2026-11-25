package ws

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// testServer mirrors Handler.ServeWS without the database: the board room comes
// from the query string and every connection is accepted.
func testServer(hub *Hub) *httptest.Server {
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		boardID, _ := strconv.ParseUint(r.URL.Query().Get("board"), 10, 64)
		client := NewClient(hub, conn, uint(boardID), 1)
		hub.Join(client)
		go client.WritePump()
		client.ReadPump()
	})

	return httptest.NewServer(mux)
}

func wsURL(ts *httptest.Server, board uint) string {
	return "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws?board=" + strconv.FormatUint(uint64(board), 10)
}

func dial(t *testing.T, ts *httptest.Server, board uint) *websocket.Conn {
	t.Helper()

	conn, _, err := websocket.DefaultDialer.Dial(wsURL(ts, board), nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	return conn
}

func readEvent(t *testing.T, conn *websocket.Conn) Event {
	t.Helper()

	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	var evt Event
	if err := conn.ReadJSON(&evt); err != nil {
		t.Fatalf("read: %v", err)
	}
	return evt
}

func TestBroadcastOnlyReachesItsRoom(t *testing.T) {
	hub := NewHub()
	srv := testServer(hub)
	defer srv.Close()

	room7a := dial(t, srv, 7)
	defer room7a.Close()
	room7b := dial(t, srv, 7)
	defer room7b.Close()
	room8 := dial(t, srv, 8)
	defer room8.Close()

	waitFor(t, func() bool { return hub.RoomSize(7) == 2 && hub.RoomSize(8) == 1 })

	hub.Broadcast(7, Event{
		Event:    EventTaskCreated,
		Payload:  map[string]any{"task": map[string]any{"id": 42, "column_id": 3}},
		SenderID: 99,
	})

	for _, conn := range []*websocket.Conn{room7a, room7b} {
		evt := readEvent(t, conn)
		if evt.Event != EventTaskCreated {
			t.Fatalf("event = %q, want %q", evt.Event, EventTaskCreated)
		}
		if evt.SenderID != 99 {
			t.Fatalf("sender_id = %d, want 99", evt.SenderID)
		}
		if evt.Payload == nil {
			t.Fatalf("payload missing")
		}
	}

	// The other room must stay silent.
	_ = room8.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
	if _, _, err := room8.ReadMessage(); err == nil {
		t.Fatalf("client in another room received the broadcast")
	}
}

func TestAbruptDisconnectCleansRoom(t *testing.T) {
	hub := NewHub()
	srv := testServer(hub)
	defer srv.Close()

	conn := dial(t, srv, 3)
	waitFor(t, func() bool { return hub.RoomSize(3) == 1 })

	// No close frame and no reads: the TCP socket just disappears.
	_ = conn.Close()

	waitFor(t, func() bool { return hub.RoomSize(3) == 0 })

	// Broadcasting into the now-empty room must not panic.
	hub.Broadcast(3, Event{Event: EventTaskDeleted, Payload: map[string]any{"id": 1}})
	hub.Broadcast(4, Event{Event: EventColumnDeleted, Payload: nil})
	if got := hub.RoomSize(3); got != 0 {
		t.Fatalf("room size = %d, want 0", got)
	}
}

func TestCloseIsIdempotent(t *testing.T) {
	hub := NewHub()
	srv := testServer(hub)
	defer srv.Close()

	conn := dial(t, srv, 5)
	waitFor(t, func() bool { return hub.RoomSize(5) == 1 })

	// The server-side client closes itself when the peer vanishes; the hub must
	// tolerate that happening while a broadcast is in flight.
	for i := 0; i < 10; i++ {
		hub.Broadcast(5, Event{Event: EventColumnUpdated, Payload: map[string]any{"id": i}})
	}
	_ = conn.Close()
	waitFor(t, func() bool { return hub.RoomSize(5) == 0 })
	hub.Broadcast(5, Event{Event: EventMemberAdded})
}

func TestConcurrentConnectBroadcastDisconnect(t *testing.T) {
	hub := NewHub()
	srv := testServer(hub)
	defer srv.Close()

	const clients = 25
	var wg sync.WaitGroup

	for i := 0; i < clients; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			conn, _, err := websocket.DefaultDialer.Dial(wsURL(srv, 11), nil)
			if err != nil {
				return
			}
			// Half read a frame, half slam the door immediately.
			_ = conn.SetReadDeadline(time.Now().Add(time.Second))
			_, _, _ = conn.ReadMessage()
			_ = conn.Close()
		}()
	}

	// Hammer the room while clients come and go.
	for i := 0; i < 200; i++ {
		hub.Broadcast(11, Event{Event: EventTaskMoved, Payload: map[string]any{"id": i}, SenderID: uint(i)})
		hub.Broadcast(12, Event{Event: EventColumnCreated, Payload: nil})
	}

	wg.Wait()
	waitFor(t, func() bool { return hub.RoomSize(11) == 0 })
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("condition not met within deadline")
}
