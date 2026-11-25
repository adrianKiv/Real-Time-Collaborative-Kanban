package service

import (
	"context"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"kanban/internal/config"
	"kanban/internal/models"
	"kanban/internal/repository"
	"kanban/internal/utils"
)

var (
	ErrEmailExists        = errors.New("email is already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrUserNotFound       = errors.New("user not found")
)

type AuthService struct {
	users repository.UserRepository
	jwt   config.JWTConfig
}

func NewAuthService(users repository.UserRepository, jwt config.JWTConfig) *AuthService {
	return &AuthService{users: users, jwt: jwt}
}

// Register creates the user and returns it together with a fresh token.
func (s *AuthService) Register(ctx context.Context, name, email, password, avatarURL string) (*models.User, string, error) {
	email = normalizeEmail(email)

	if _, err := s.users.FindByEmail(ctx, email); err == nil {
		return nil, "", ErrEmailExists
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, "", err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", err
	}

	user := &models.User{
		Name:         strings.TrimSpace(name),
		Email:        email,
		PasswordHash: string(hash),
		AvatarURL:    strings.TrimSpace(avatarURL),
	}

	if err := s.users.Create(ctx, user); err != nil {
		return nil, "", err
	}

	token, err := utils.GenerateToken(user.ID, s.jwt.Secret, s.jwt.TTL)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}

// Login verifies credentials and returns the user together with a fresh token.
func (s *AuthService) Login(ctx context.Context, email, password string) (*models.User, string, error) {
	user, err := s.users.FindByEmail(ctx, normalizeEmail(email))
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, "", ErrInvalidCredentials
		}
		return nil, "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", ErrInvalidCredentials
	}

	token, err := utils.GenerateToken(user.ID, s.jwt.Secret, s.jwt.TTL)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}

// Profile returns the authenticated user.
func (s *AuthService) Profile(ctx context.Context, userID uint) (*models.User, error) {
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return user, nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
