package service

import (
	"context"
	"errors"
	"strings"

	"kanban/internal/models"
	"kanban/internal/repository"
	"kanban/internal/ws"
)

type ColumnService struct {
	columns repository.ColumnRepository
	boards  repository.BoardRepository
	events  Broadcaster
}

func NewColumnService(columns repository.ColumnRepository, boards repository.BoardRepository, events Broadcaster) *ColumnService {
	return &ColumnService{columns: columns, boards: boards, events: events}
}

// Create appends a column at the end of the board.
func (s *ColumnService) Create(ctx context.Context, userID, boardID uint, title string) (*models.Column, error) {
	if _, err := requireMember(ctx, s.boards, boardID, userID); err != nil {
		return nil, err
	}

	title = strings.TrimSpace(title)
	if title == "" {
		return nil, ErrTitleRequired
	}

	position, err := s.columns.NextPosition(ctx, boardID)
	if err != nil {
		return nil, err
	}

	column := &models.Column{BoardID: boardID, Title: title, Position: position, Tasks: []models.Task{}}
	if err := s.columns.Create(ctx, column); err != nil {
		return nil, err
	}

	broadcast(s.events, column.BoardID, ws.EventColumnCreated, column, userID)

	return column, nil
}

// Update renames a column.
func (s *ColumnService) Update(ctx context.Context, userID, columnID uint, title string) (*models.Column, error) {
	column, err := s.columnForMember(ctx, userID, columnID)
	if err != nil {
		return nil, err
	}

	title = strings.TrimSpace(title)
	if title == "" {
		return nil, ErrTitleRequired
	}

	if err := s.columns.UpdateTitle(ctx, column.ID, title); err != nil {
		return nil, err
	}
	column.Title = title
	column.Tasks = []models.Task{}

	broadcast(s.events, column.BoardID, ws.EventColumnUpdated, column, userID)

	return column, nil
}

// Delete removes a column and (via FK cascade) all of its tasks.
func (s *ColumnService) Delete(ctx context.Context, userID, columnID uint) error {
	column, err := s.columnForMember(ctx, userID, columnID)
	if err != nil {
		return err
	}

	if err := s.columns.Delete(ctx, column.ID); err != nil {
		return err
	}

	broadcast(s.events, column.BoardID, ws.EventColumnDeleted, map[string]any{
		"id":       column.ID,
		"board_id": column.BoardID,
	}, userID)

	return nil
}

// columnForMember loads a column and verifies the user belongs to its board.
func (s *ColumnService) columnForMember(ctx context.Context, userID, columnID uint) (*models.Column, error) {
	column, err := s.columns.FindByID(ctx, columnID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrColumnNotFound
		}
		return nil, err
	}
	if _, err := requireMember(ctx, s.boards, column.BoardID, userID); err != nil {
		return nil, err
	}
	return column, nil
}
