package service

import (
	"testing"

	"kanban/internal/ws"
)

type recordingBroadcaster struct {
	calls  int
	evt    ws.Event
	roomID uint
}

func (r *recordingBroadcaster) Broadcast(boardID uint, evt ws.Event) {
	r.calls++
	r.evt = evt
	r.roomID = boardID
}

// Services are silently realtime-free when no hub is wired in.
func TestNilBroadcasterIsSafe(t *testing.T) {
	broadcast(nil, 1, ws.EventTaskCreated, map[string]any{"id": 1}, 1)
}

func TestBroadcastBuildsEnvelope(t *testing.T) {
	rec := &recordingBroadcaster{}

	broadcast(rec, 5, ws.EventColumnDeleted, map[string]any{"id": 3}, 9)

	if rec.calls != 1 {
		t.Fatalf("calls = %d, want 1", rec.calls)
	}
	if rec.roomID != 5 {
		t.Fatalf("room = %d, want 5", rec.roomID)
	}
	if rec.evt.Event != ws.EventColumnDeleted {
		t.Fatalf("event = %q", rec.evt.Event)
	}
	if rec.evt.SenderID != 9 {
		t.Fatalf("sender = %d, want 9", rec.evt.SenderID)
	}
	if rec.evt.Payload == nil {
		t.Fatalf("payload missing")
	}
}

// boardID 0 means the entity could not be resolved; nothing is emitted.
func TestBroadcastSkipsUnknownBoard(t *testing.T) {
	rec := &recordingBroadcaster{}

	broadcast(rec, 0, ws.EventTaskUpdated, nil, 1)

	if rec.calls != 0 {
		t.Fatalf("calls = %d, want 0", rec.calls)
	}
}
