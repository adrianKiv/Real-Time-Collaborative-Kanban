package models

import "time"

type Board struct {
	ID          uint          `gorm:"primaryKey" json:"id"`
	Title       string        `gorm:"size:160;not null" json:"title"`
	Description string        `gorm:"type:text" json:"description"`
	OwnerID     uint          `gorm:"not null;index" json:"owner_id"`
	Owner       *User         `gorm:"foreignKey:OwnerID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"owner,omitempty"`
	CreatedAt   time.Time     `json:"created_at"`
	Members     []BoardMember `gorm:"foreignKey:BoardID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"members"`
	Columns     []Column      `gorm:"foreignKey:BoardID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"columns"`
}
