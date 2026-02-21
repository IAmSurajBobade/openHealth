.PHONY: install dev build preview lint clean help

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install npm dependencies
	npm install

dev: ## Start the development server
	npm run dev

build: ## Build the web application for production (creates static assets in dist/)
	npm run build

preview: ## Preview the production build locally
	npm run preview

lint: ## Run ESLint to check for code issues
	npm run lint

clean: ## Remove node_modules and dist directories (fresh start)
	rm -rf node_modules
	rm -rf dist
