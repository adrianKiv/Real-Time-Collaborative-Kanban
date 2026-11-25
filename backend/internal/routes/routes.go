package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"kanban/internal/config"
	"kanban/internal/handler"
	"kanban/internal/middleware"
	"kanban/internal/repository"
	"kanban/internal/service"
	"kanban/internal/ws"
)

// New wires dependencies and returns the fully configured router.
func New(db *gorm.DB, cfg *config.Config) *gin.Engine {
	router := gin.New()
	router.Use(middleware.RequestLogger(), gin.Recovery(), middleware.CORS(cfg.AllowedOrigins))

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})

	// Repositories
	userRepo := repository.NewUserRepository(db)
	boardRepo := repository.NewBoardRepository(db)
	columnRepo := repository.NewColumnRepository(db)
	taskRepo := repository.NewTaskRepository(db)

	// Realtime hub (also the service Broadcaster)
	hub := ws.NewHub()

	// Services
	authService := service.NewAuthService(userRepo, cfg.JWT)
	boardService := service.NewBoardService(boardRepo, userRepo, hub)
	columnService := service.NewColumnService(columnRepo, boardRepo, hub)
	taskService := service.NewTaskService(taskRepo, columnRepo, boardRepo, hub)

	// Handlers
	authHandler := handler.NewAuthHandler(authService)
	boardHandler := handler.NewBoardHandler(boardService)
	columnHandler := handler.NewColumnHandler(columnService)
	taskHandler := handler.NewTaskHandler(taskService)
	wsHandler := ws.NewHandler(hub, boardRepo, cfg.JWT.Secret, cfg.AllowedOrigins)

	api := router.Group("/api")

	auth := api.Group("/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
		auth.GET("/me", middleware.RequireAuth(cfg.JWT.Secret), authHandler.Me)
	}

	protected := api.Group("", middleware.RequireAuth(cfg.JWT.Secret))
	{
		boards := protected.Group("/boards")
		{
			boards.GET("", boardHandler.List)
			boards.POST("", boardHandler.Create)
			boards.GET("/:id", boardHandler.Get)
			boards.POST("/:id/members", boardHandler.AddMember)
			boards.POST("/:id/columns", columnHandler.Create)
		}

		columns := protected.Group("/columns")
		{
			columns.PUT("/:id", columnHandler.Update)
			columns.DELETE("/:id", columnHandler.Delete)
			columns.POST("/:id/tasks", taskHandler.Create)
		}

		tasks := protected.Group("/tasks")
		{
			tasks.PUT("/:id", taskHandler.Update)
			tasks.DELETE("/:id", taskHandler.Delete)
			tasks.PATCH("/:id/move", taskHandler.Move)
		}
	}

	// Websocket room: token + board membership checked before the upgrade.
	router.GET("/ws/boards/:id", wsHandler.ServeWS)

	return router
}
