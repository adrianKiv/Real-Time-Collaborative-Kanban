package service

import "kanban/internal/ws"

// Broadcaster fans board events out to websocket rooms.
// A nil Broadcaster disables realtime (handy for tests and services).
type Broadcaster interface {
	Broadcast(boardID uint, evt ws.Event)
}

// broadcast is the nil-safe emit helper used by the mutation methods.
func broadcast(b Broadcaster, boardID uint, event string, payload any, senderID uint) {
	if b == nil || boardID == 0 {
		return
	}
	b.Broadcast(boardID, ws.Event{Event: event, Payload: payload, SenderID: senderID})
}
