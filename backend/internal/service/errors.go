package service

import "errors"

var (
	ErrBoardNotFound  = errors.New("board not found")
	ErrColumnNotFound = errors.New("column not found")
	ErrTaskNotFound   = errors.New("task not found")

	ErrForbidden     = errors.New("you do not have access to this board")
	ErrNotBoardAdmin = errors.New("only board admins can perform this action")

	ErrTitleRequired  = errors.New("title is required")
	ErrInvalidPrior   = errors.New("priority must be one of: low, medium, high")
	ErrAlreadyMember  = errors.New("user is already a member of this board")
	ErrMemberNotFound = errors.New("no user found with that email")

	ErrAssigneeNotMember   = errors.New("assignee must be a member of this board")
	ErrColumnBoardMismatch = errors.New("target column belongs to a different board")
)
