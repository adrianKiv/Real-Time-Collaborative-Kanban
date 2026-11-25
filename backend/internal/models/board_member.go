package models

// Role values allowed for a board member.
const (
	RoleAdmin  = "admin"
	RoleMember = "member"
)

// BoardMember is the join table between boards and users (composite PK).
type BoardMember struct {
	BoardID uint   `gorm:"primaryKey" json:"board_id"`
	UserID  uint   `gorm:"primaryKey" json:"user_id"`
	Role    string `gorm:"size:20;not null;default:member;check:chk_board_member_role,role IN ('admin','member')" json:"role"`
	User    User   `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"user,omitempty"`
}
