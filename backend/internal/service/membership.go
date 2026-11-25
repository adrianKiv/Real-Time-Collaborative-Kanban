package service

import (
	"context"
	"errors"

	"kanban/internal/models"
	"kanban/internal/repository"
)

// requireMember returns the membership row or a permission error.
// Missing boards are reported as 404-style errors, non-members as forbidden,
// so board existence is not leaked.
func requireMember(ctx context.Context, boards repository.BoardRepository, boardID, userID uint) (*models.BoardMember, error) {
	member, err := boards.FindMember(ctx, boardID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			exists, existsErr := boards.Exists(ctx, boardID)
			if existsErr != nil {
				return nil, existsErr
			}
			if !exists {
				return nil, ErrBoardNotFound
			}
			return nil, ErrForbidden
		}
		return nil, err
	}
	return member, nil
}

// requireBoardAdmin additionally checks the admin role.
func requireBoardAdmin(ctx context.Context, boards repository.BoardRepository, boardID, userID uint) (*models.BoardMember, error) {
	member, err := requireMember(ctx, boards, boardID, userID)
	if err != nil {
		return nil, err
	}
	if member.Role != models.RoleAdmin {
		return nil, ErrNotBoardAdmin
	}
	return member, nil
}
