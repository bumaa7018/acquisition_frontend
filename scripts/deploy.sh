#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
GIT_REMOTE="${GIT_REMOTE:-origin}"

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE файл байхгүй байна" >&2
  exit 1
fi

git() { command git -c "safe.directory=*" "$@"; }

if ! command -v git >/dev/null 2>&1; then
  echo "git олдсонгүй" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker олдсонгүй" >&2
  exit 1
fi

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

current_branch="$(git rev-parse --abbrev-ref HEAD)"
GIT_BRANCH="${GIT_BRANCH:-$current_branch}"

if [[ "${SKIP_GIT_PULL:-0}" != "1" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree dirty байна. Deploy хийхийн өмнө commit хийгдээгүй өөрчлөлт байна." >&2
    git status --short >&2
    exit 1
  fi

  echo "Git update шалгаж байна: $GIT_REMOTE/$GIT_BRANCH"
  git fetch --prune "$GIT_REMOTE"
  git pull --ff-only "$GIT_REMOTE" "$GIT_BRANCH"
fi

project_name="$(compose config --project-name)"

echo "Docker container/image цэвэрлэж байна..."
compose down --remove-orphans --rmi local

echo "Compose project-ийн volume-уудыг устгаж байна..."
while IFS= read -r volume; do
  [[ -n "$volume" ]] || continue
  docker volume rm "$volume" >/dev/null || true
done < <(docker volume ls -q --filter "label=com.docker.compose.project=$project_name")

echo "Unused Docker image/build cache цэвэрлэж байна..."
docker image prune -af
docker builder prune -af

echo "Docker image шинээр build хийж байна..."
compose build --pull --no-cache

echo "gov_network сүлжээ шалгаж байна..."
docker network inspect gov_network >/dev/null 2>&1 || {
  echo "gov_network олдсонгүй. Backend-г эхлээд асаана уу." >&2
  exit 1
}

echo "Docker service-үүдийг шинээр асааж байна..."
compose up -d --force-recreate --remove-orphans

compose ps
