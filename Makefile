.PHONY: dev build start lint install \
        docker-build docker-up docker-down docker-run docker-restart docker-logs docker-clean \
        docker-dev docker-dev-down docker-dev-logs docker-fg \
        deploy docker-rebuild

COMPOSE     = docker compose
COMPOSE_DEV = docker compose -f docker-compose.dev.yml

# ── Local dev ─────────────────────────────────────────
dev:
	npm run dev -- --turbo

build:
	npm run build

start:
	npm run start

lint:
	npm run lint

install:
	npm install

# ── Docker ────────────────────────────────────────────
# gov_network-г backend (government/) үүсгэдэг.
# Frontend зөвхөн тэр сүлжээнд нэгддэг — backend ажиллаж байх ёстой.

docker-check-network:
	@docker network inspect gov_network >/dev/null 2>&1 || \
		(echo "gov_network олдсонгүй. Эхлээд backend-г асаана уу:" && \
		 echo "  cd ../government/deployments && docker compose up -d" && exit 1)

build:
	$(COMPOSE) build
	docker image prune -f

up: docker-check-network
	$(COMPOSE) up -d

# build хийгээд foreground-д ажиллуулна (лог шууд харагдана, Ctrl+C-р зогсоно)
docker-fg: docker-check-network
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

# build → up → log (Ctrl+C дарахад зогсоно)
docker-run: docker-build docker-up
	$(COMPOSE) logs -f --tail=100

# код өөрчилсний дараа хурдан redeploy
docker-restart: docker-build docker-check-network
	$(COMPOSE) up -d --force-recreate
	$(COMPOSE) logs -f --tail=100

# алдааг шалгах — ажиллаж буй контейнерийн лог
docker-logs:
	$(COMPOSE) logs -f --tail=200

# ── Docker dev (hot-reload) ───────────────────────────
# src/ өөрчлөгдөхөд container дотор шууд харагдана
docker-dev: docker-check-network
	$(COMPOSE_DEV) up --build

docker-dev-down:
	$(COMPOSE_DEV) down

docker-dev-logs:
	$(COMPOSE_DEV) logs -f --tail=200

# ── Docker clean ──────────────────────────────────────
# хуучин image, layer, build cache цэвэрлэх(500MB үлдээнэ)
docker-clean:
	$(COMPOSE) down
	docker image prune -f
	docker builder prune -f --keep-storage=500mb

# ── Deploy (deploy user) ───────────────────────────────
# git pull → build → recreate (server дээр deploy user ажиллуулна)
deploy:
	./scripts/deploy.sh

# git pull алгасаад шууд build хийх (локал тест)
docker-rebuild:
	SKIP_GIT_PULL=1 ./scripts/deploy.sh
