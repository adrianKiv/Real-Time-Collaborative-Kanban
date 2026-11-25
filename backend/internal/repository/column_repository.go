package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"kanban/internal/models"
)

type ColumnRepository interface {
	Create(ctx context.Context, column *models.Column) error
	FindByID(ctx context.Context, id uint) (*models.Column, error)
	NextPosition(ctx context.Context, boardID uint) (float64, error)
	UpdateTitle(ctx context.Context, id uint, title string) error
	UpdatePosition(ctx context.Context, id uint, position float64) error
	Delete(ctx context.Context, id uint) error
}

type columnRepository struct {
	db *gorm.DB
}

func NewColumnRepository(db *gorm.DB) ColumnRepository {
	return &columnRepository{db: db}
}

func (r *columnRepository) Create(ctx context.Context, column *models.Column) error {
	return r.db.WithContext(ctx).Create(column).Error
}

func (r *columnRepository) FindByID(ctx context.Context, id uint) (*models.Column, error) {
	var column models.Column
	err := r.db.WithContext(ctx).First(&column, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &column, nil
}

// NextPosition returns max(position)+1000 so new items land at the end.
func (r *columnRepository) NextPosition(ctx context.Context, boardID uint) (float64, error) {
	var next float64
	row := r.db.WithContext(ctx).
		Model(&models.Column{}).
		Where("board_id = ?", boardID).
		Select("COALESCE(MAX(position), 0) + 1000").
		Row()
	if err := row.Scan(&next); err != nil {
		return 0, err
	}
	return next, nil
}

func (r *columnRepository) UpdateTitle(ctx context.Context, id uint, title string) error {
	return r.db.WithContext(ctx).
		Model(&models.Column{}).
		Where("id = ?", id).
		Update("title", title).Error
}

func (r *columnRepository) UpdatePosition(ctx context.Context, id uint, position float64) error {
	return r.db.WithContext(ctx).
		Model(&models.Column{}).
		Where("id = ?", id).
		Update("position", position).Error
}

func (r *columnRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Column{}, id).Error
}
