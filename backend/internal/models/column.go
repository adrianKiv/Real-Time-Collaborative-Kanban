package models

// Column is a board column. Position is a float so cards/columns can be
// re-ordered by inserting a value between two neighbours (fractional indexing).
type Column struct {
	ID       uint    `gorm:"primaryKey" json:"id"`
	BoardID  uint    `gorm:"not null;index" json:"board_id"`
	Title    string  `gorm:"size:160;not null" json:"title"`
	Position float64 `gorm:"not null;default:1000" json:"position"`
	Tasks    []Task  `gorm:"foreignKey:ColumnID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"tasks"`
}
