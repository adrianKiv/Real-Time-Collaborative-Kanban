package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"kanban/internal/models"
)

type TaskRepository interface {
	Create(ctx context.Context, task *models.Task) error
	FindByID(ctx context.Context, id uint) (*models.Task, error)
	NextPosition(ctx context.Context, columnID uint) (float64, error)
	Update(ctx context.Context, id uint, values map[string]any) error
	Delete(ctx context.Context, id uint) error
	Move(ctx context.Context, id, toColumnID uint, position float64) error
}

type taskRepository struct {
	db *gorm.DB
}

func NewTaskRepository(db *gorm.DB) TaskRepository {
	return &taskRepository{db: db}
}

func (r *taskRepository) Create(ctx context.Context, task *models.Task) error {
	return r.db.WithContext(ctx).Create(task).Error
}

func (r *taskRepository) FindByID(ctx context.Context, id uint) (*models.Task, error) {
	var task models.Task
	err := r.db.WithContext(ctx).Preload("Assignee").First(&task, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// NextPosition returns max(position)+1000 so new tasks land at the bottom.
func (r *taskRepository) NextPosition(ctx context.Context, columnID uint) (float64, error) {
	var next float64
	row := r.db.WithContext(ctx).
		Model(&models.Task{}).
		Where("column_id = ?", columnID).
		Select("COALESCE(MAX(position), 0) + 1000").
		Row()
	if err := row.Scan(&next); err != nil {
		return 0, err
	}
	return next, nil
}

func (r *taskRepository) Update(ctx context.Context, id uint, values map[string]any) error {
	return r.db.WithContext(ctx).
		Model(&models.Task{}).
		Where("id = ?", id).
		Updates(values).Error
}

func (r *taskRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Task{}, id).Error
}

// Move re-parents a task inside a single transaction, locking the row so two
// concurrent drags cannot interleave.
func (r *taskRepository) Move(ctx context.Context, id, toColumnID uint, position float64) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var task models.Task
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&task, id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrNotFound
			}
			return err
		}

		return tx.Model(&models.Task{}).
			Where("id = ?", id).
			Updates(map[string]any{"column_id": toColumnID, "position": position}).Error
	})
}
