package service

import (
	"context"
	"errors"
	"strings"

	"kanban/internal/models"
	"kanban/internal/repository"
	"kanban/internal/ws"
)

type CreateBoardInput struct {
	Title       string
	Description string
}

type BoardService struct {
	boards repository.BoardRepository
	users  repository.UserRepository
	events Broadcaster
}

func NewBoardService(boards repository.BoardRepository, users repository.UserRepository, events Broadcaster) *BoardService {
	return &BoardService{boards: boards, users: users, events: events}
}

// List returns every board the user belongs to.
func (s *BoardService) List(ctx context.Context, userID uint) ([]models.Board, error) {
	return s.boards.ListForUser(ctx, userID)
}

// Create builds a board with an admin membership and the default columns.
func (s *BoardService) Create(ctx context.Context, userID uint, in CreateBoardInput) (*models.Board, error) {
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, ErrTitleRequired
	}

	board := &models.Board{
		Title:       title,
		Description: strings.TrimSpace(in.Description),
		OwnerID:     userID,
	}
	if err := s.boards.CreateWithDefaults(ctx, board); err != nil {
		return nil, err
	}

	// Reload so the response carries the owner and fully shaped columns.
	detail, err := s.boards.FindDetail(ctx, board.ID)
	if err != nil {
		return nil, err
	}
	return detail, nil
}

// Get returns board details (members, ordered columns, ordered tasks).
func (s *BoardService) Get(ctx context.Context, userID, boardID uint) (*models.Board, error) {
	if _, err := requireMember(ctx, s.boards, boardID, userID); err != nil {
		return nil, err
	}
	board, err := s.boards.FindDetail(ctx, boardID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrBoardNotFound
		}
		return nil, err
	}
	return board, nil
}

// Update changes a board's title and description. Only board admins may edit it.
func (s *BoardService) Update(ctx context.Context, userID, boardID uint, in CreateBoardInput) (*models.Board, error) {
	if _, err := requireBoardAdmin(ctx, s.boards, boardID, userID); err != nil {
		return nil, err
	}

	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, ErrTitleRequired
	}
	if err := s.boards.UpdateDetails(ctx, boardID, title, strings.TrimSpace(in.Description)); err != nil {
		return nil, err
	}

	board, err := s.boards.FindDetail(ctx, boardID)
	if err != nil {
		return nil, err
	}
	broadcast(s.events, boardID, ws.EventBoardUpdated, board, userID)
	return board, nil
}

// Delete removes a board and its dependent members, columns, and tasks.
func (s *BoardService) Delete(ctx context.Context, userID, boardID uint) error {
	if _, err := requireBoardAdmin(ctx, s.boards, boardID, userID); err != nil {
		return err
	}
	if err := s.boards.Delete(ctx, boardID); err != nil {
		return err
	}
	broadcast(s.events, boardID, ws.EventBoardDeleted, map[string]uint{"id": boardID}, userID)
	return nil
}

// AddMember invites an existing user (by email) as a plain member. Admin only.
func (s *BoardService) AddMember(ctx context.Context, userID, boardID uint, email string) (*models.BoardMember, error) {
	if _, err := requireBoardAdmin(ctx, s.boards, boardID, userID); err != nil {
		return nil, err
	}

	user, err := s.users.FindByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrMemberNotFound
		}
		return nil, err
	}

	if _, err := s.boards.FindMember(ctx, boardID, user.ID); err == nil {
		return nil, ErrAlreadyMember
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	member := &models.BoardMember{BoardID: boardID, UserID: user.ID, Role: models.RoleMember}
	if err := s.boards.AddMember(ctx, member); err != nil {
		return nil, err
	}
	member.User = *user

	broadcast(s.events, boardID, ws.EventMemberAdded, member, userID)

	return member, nil
}
