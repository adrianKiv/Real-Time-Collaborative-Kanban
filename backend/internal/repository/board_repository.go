package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"kanban/internal/models"
)

// defaultColumns are created for every new board.
var defaultColumns = []struct {
	Title    string
	Position float64
}{
	{Title: "To Do", Position: 1000},
	{Title: "In Progress", Position: 2000},
	{Title: "Done", Position: 3000},
}

type BoardRepository interface {
	// CreateWithDefaults creates the board, its admin membership and the
	// three default columns inside a single transaction.
	CreateWithDefaults(ctx context.Context, board *models.Board) error
	AddMember(ctx context.Context, member *models.BoardMember) error
	FindMember(ctx context.Context, boardID, userID uint) (*models.BoardMember, error)
	Exists(ctx context.Context, boardID uint) (bool, error)
	ListForUser(ctx context.Context, userID uint) ([]models.Board, error)
	FindDetail(ctx context.Context, boardID uint) (*models.Board, error)
}

type boardRepository struct {
	db *gorm.DB
}

func NewBoardRepository(db *gorm.DB) BoardRepository {
	return &boardRepository{db: db}
}

func (r *boardRepository) CreateWithDefaults(ctx context.Context, board *models.Board) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(board).Error; err != nil {
			return err
		}

		member := &models.BoardMember{BoardID: board.ID, UserID: board.OwnerID, Role: models.RoleAdmin}
		if err := tx.Create(member).Error; err != nil {
			return err
		}

		columns := make([]models.Column, 0, len(defaultColumns))
		for _, dc := range defaultColumns {
			columns = append(columns, models.Column{BoardID: board.ID, Title: dc.Title, Position: dc.Position})
		}
		if err := tx.Create(&columns).Error; err != nil {
			return err
		}

		board.Members = []models.BoardMember{*member}
		board.Columns = columns
		return nil
	})
}

func (r *boardRepository) AddMember(ctx context.Context, member *models.BoardMember) error {
	return r.db.WithContext(ctx).Create(member).Error
}

func (r *boardRepository) FindMember(ctx context.Context, boardID, userID uint) (*models.BoardMember, error) {
	var member models.BoardMember
	err := r.db.WithContext(ctx).
		Where("board_id = ? AND user_id = ?", boardID, userID).
		First(&member).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &member, nil
}

func (r *boardRepository) Exists(ctx context.Context, boardID uint) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Board{}).Where("id = ?", boardID).Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *boardRepository) ListForUser(ctx context.Context, userID uint) ([]models.Board, error) {
	boards := make([]models.Board, 0)
	err := r.db.WithContext(ctx).
		Model(&models.Board{}).
		Joins("JOIN board_members ON board_members.board_id = boards.id").
		Where("board_members.user_id = ?", userID).
		Order("boards.created_at DESC, boards.id DESC").
		Find(&boards).Error
	if err != nil {
		return nil, err
	}
	for i := range boards {
		boards[i].Members = []models.BoardMember{}
		boards[i].Columns = []models.Column{}
	}
	return boards, nil
}

func (r *boardRepository) FindDetail(ctx context.Context, boardID uint) (*models.Board, error) {
	var board models.Board
	err := r.db.WithContext(ctx).
		Preload("Owner").
		Preload("Members", func(db *gorm.DB) *gorm.DB { return db.Order("user_id ASC") }).
		Preload("Members.User").
		Preload("Columns", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC, id ASC") }).
		Preload("Columns.Tasks", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC, id ASC") }).
		Preload("Columns.Tasks.Assignee").
		First(&board, boardID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	// Always emit arrays (never omitted/null) so clients can iterate safely.
	if board.Members == nil {
		board.Members = []models.BoardMember{}
	}
	if board.Columns == nil {
		board.Columns = []models.Column{}
	}
	for i := range board.Columns {
		if board.Columns[i].Tasks == nil {
			board.Columns[i].Tasks = []models.Task{}
		}
	}

	return &board, nil
}
