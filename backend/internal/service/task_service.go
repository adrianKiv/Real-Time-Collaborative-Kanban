package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"kanban/internal/models"
	"kanban/internal/repository"
	"kanban/internal/ws"
)

type CreateTaskInput struct {
	Title       string
	Description string
	Priority    string
	AssigneeID  *uint
	DueDate     *time.Time
}

// UpdateTaskInput uses pointers to tell "absent" from "set".
// A nil AssigneeID / nil DueDate leaves the field untouched; a zero value
// (assignee_id = 0, zero timestamp) clears it.
type UpdateTaskInput struct {
	Title       *string
	Description *string
	Priority    *string
	AssigneeID  *uint
	DueDate     *time.Time
}

type TaskService struct {
	tasks   repository.TaskRepository
	columns repository.ColumnRepository
	boards  repository.BoardRepository
	events  Broadcaster
}

func NewTaskService(tasks repository.TaskRepository, columns repository.ColumnRepository, boards repository.BoardRepository, events Broadcaster) *TaskService {
	return &TaskService{tasks: tasks, columns: columns, boards: boards, events: events}
}

// Create appends a task to the bottom of a column.
func (s *TaskService) Create(ctx context.Context, userID, columnID uint, in CreateTaskInput) (*models.Task, error) {
	column, err := s.columnForMember(ctx, userID, columnID)
	if err != nil {
		return nil, err
	}

	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, ErrTitleRequired
	}

	priority, err := normalizePriority(in.Priority, models.PriorityMedium)
	if err != nil {
		return nil, err
	}

	assigneeID, err := s.validAssignee(ctx, column.BoardID, in.AssigneeID)
	if err != nil {
		return nil, err
	}

	position, err := s.tasks.NextPosition(ctx, column.ID)
	if err != nil {
		return nil, err
	}

	task := &models.Task{
		ColumnID:    column.ID,
		Title:       title,
		Description: strings.TrimSpace(in.Description),
		Priority:    priority,
		Position:    position,
		AssigneeID:  assigneeID,
		DueDate:     in.DueDate,
	}
	if err := s.tasks.Create(ctx, task); err != nil {
		return nil, err
	}

	created, err := s.tasks.FindByID(ctx, task.ID)
	if err != nil {
		return nil, err
	}

	broadcast(s.events, column.BoardID, ws.EventTaskCreated, created, userID)

	return created, nil
}

// Update applies a partial update to a task.
func (s *TaskService) Update(ctx context.Context, userID, taskID uint, in UpdateTaskInput) (*models.Task, error) {
	task, boardID, err := s.taskForMember(ctx, userID, taskID)
	if err != nil {
		return nil, err
	}

	values := map[string]any{}

	if in.Title != nil {
		title := strings.TrimSpace(*in.Title)
		if title == "" {
			return nil, ErrTitleRequired
		}
		values["title"] = title
	}

	if in.Description != nil {
		values["description"] = strings.TrimSpace(*in.Description)
	}

	if in.Priority != nil {
		priority, err := normalizePriority(*in.Priority, "")
		if err != nil {
			return nil, err
		}
		values["priority"] = priority
	}

	if in.AssigneeID != nil {
		assigneeID, err := s.validAssignee(ctx, boardID, in.AssigneeID)
		if err != nil {
			return nil, err
		}
		if assigneeID == nil {
			values["assignee_id"] = nil
		} else {
			values["assignee_id"] = *assigneeID
		}
	}

	if in.DueDate != nil {
		if in.DueDate.IsZero() {
			values["due_date"] = nil
		} else {
			values["due_date"] = *in.DueDate
		}
	}

	if len(values) > 0 {
		if err := s.tasks.Update(ctx, task.ID, values); err != nil {
			return nil, err
		}
	}

	updated, err := s.tasks.FindByID(ctx, task.ID)
	if err != nil {
		return nil, err
	}

	if len(values) > 0 {
		broadcast(s.events, boardID, ws.EventTaskUpdated, updated, userID)
	}

	return updated, nil
}

// Delete removes a task.
func (s *TaskService) Delete(ctx context.Context, userID, taskID uint) error {
	task, boardID, err := s.taskForMember(ctx, userID, taskID)
	if err != nil {
		return err
	}

	if err := s.tasks.Delete(ctx, task.ID); err != nil {
		return err
	}

	broadcast(s.events, boardID, ws.EventTaskDeleted, map[string]any{
		"id":        task.ID,
		"board_id":  boardID,
		"column_id": task.ColumnID,
	}, userID)

	return nil
}

// Move re-parents a task to another column of the same board inside a transaction.
func (s *TaskService) Move(ctx context.Context, userID, taskID uint, toColumnID uint, newPosition float64) (*models.Task, error) {
	task, boardID, err := s.taskForMember(ctx, userID, taskID)
	if err != nil {
		return nil, err
	}

	target, err := s.columns.FindByID(ctx, toColumnID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrColumnNotFound
		}
		return nil, err
	}

	if target.BoardID != boardID {
		return nil, ErrColumnBoardMismatch
	}

	if err := s.tasks.Move(ctx, task.ID, target.ID, newPosition); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrTaskNotFound
		}
		return nil, err
	}

	moved, err := s.tasks.FindByID(ctx, task.ID)
	if err != nil {
		return nil, err
	}

	broadcast(s.events, boardID, ws.EventTaskMoved, moved, userID)

	return moved, nil
}

// taskForMember loads a task, resolves its board and verifies membership.
func (s *TaskService) taskForMember(ctx context.Context, userID, taskID uint) (*models.Task, uint, error) {
	task, err := s.tasks.FindByID(ctx, taskID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, 0, ErrTaskNotFound
		}
		return nil, 0, err
	}

	column, err := s.columns.FindByID(ctx, task.ColumnID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, 0, ErrColumnNotFound
		}
		return nil, 0, err
	}

	if _, err := requireMember(ctx, s.boards, column.BoardID, userID); err != nil {
		return nil, 0, err
	}

	return task, column.BoardID, nil
}

// validAssignee ensures the assignee belongs to the board. A nil pointer or 0
// means "unassigned".
func (s *TaskService) validAssignee(ctx context.Context, boardID uint, assigneeID *uint) (*uint, error) {
	if assigneeID == nil || *assigneeID == 0 {
		return nil, nil
	}
	if _, err := s.boards.FindMember(ctx, boardID, *assigneeID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrAssigneeNotMember
		}
		return nil, err
	}
	return assigneeID, nil
}

func (s *TaskService) columnForMember(ctx context.Context, userID, columnID uint) (*models.Column, error) {
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

func normalizePriority(raw, fallback string) (string, error) {
	priority := strings.ToLower(strings.TrimSpace(raw))
	if priority == "" {
		priority = fallback
	}
	switch priority {
	case models.PriorityLow, models.PriorityMedium, models.PriorityHigh:
		return priority, nil
	default:
		return "", ErrInvalidPrior
	}
}
