package main

import (
	"log"

	"github.com/gin-gonic/gin"

	"kanban/internal/config"
	"kanban/internal/routes"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	db, err := config.Connect(cfg.Database, cfg.IsProduction())
	if err != nil {
		log.Fatalf("database: %v", err)
	}

	if err := config.Migrate(db); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	router := routes.New(db, cfg)

	log.Printf("kanban api listening on :%s (env=%s)", cfg.Port, cfg.AppEnv)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server: %v", err)
	}
}
