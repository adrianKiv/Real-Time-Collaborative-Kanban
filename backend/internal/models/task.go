package models

import "time"

// Priority values allowed for a task.
const (
	PriorityLow    = "low"
	PriorityMedium = "medium"
	PriorityHigh   = "high"
)

type Task struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	ColumnID    uint       `gorm:"not null;index" json:"column_id"`
	Title       string     `gorm:"size:200;not null" json:"title"`
	Description string     `gorm:"type:text" json:"description"`
	Priority    string     `gorm:"size:10;not null;default:medium;check:chk_task_priority,priority IN ('low','medium','high')" json:"priority"`
	Position    float64    `gorm:"not null;default:1000" json:"position"`
	AssigneeID  *uint      `gorm:"index" json:"assignee_id"`
	Assignee    *User      `gorm:"foreignKey:AssigneeID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"assignee,omitempty"`
	DueDate     *time.Time `json:"due_date"`
	CreatedAt   time.Time  `json:"created_at"`
}
