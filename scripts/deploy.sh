#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
GIT_REMOTE="${GIT_REMOTE:-origin}"

cd "$ROOT_DIR"

if ! command -v git >/dev/null 2>&1; then
  echo "git олдсонгүй" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker олдсонгүй" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE файл байхгүй байна" >&2
  exit 1
fi

git() { command git -c "safe.directory=*" "$@"; }

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

current_branch="$(git rev-parse --abbrev-ref HEAD)"
GIT_BRANCH="${GIT_BRANCH:-$current_branch}"

if [[ "${SKIP_GIT_PULL:-0}" != "1" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree dirty байна. Deploy user дээр commit хийгдээгүй өөрчлөлт үлдсэн тул pull хийхгүй." >&2
    git status --short >&2
    exit 1
  fi

  old_sha="$(git rev-parse HEAD)"

  echo "Git update шалгаж байна: $GIT_REMOTE/$GIT_BRANCH"
  git fetch --prune "$GIT_REMOTE"
  git pull --ff-only "$GIT_REMOTE" "$GIT_BRANCH"

  new_sha="$(git rev-parse HEAD)"
  if [[ "$old_sha" != "$new_sha" && "${DEPLOY_REEXECED:-0}" != "1" ]]; then
    echo "Repo шинэчлэгдсэн тул deploy script-ийг шинэ хувилбараар дахин ажиллуулж байна..."
    exec env SKIP_GIT_PULL=1 DEPLOY_REEXECED=1 "$ROOT_DIR/scripts/deploy.sh"
  fi
fi

echo "Docker image build хийж байна..."
compose build --pull

echo "Docker service-үүдийг шинээр асааж байна..."
compose up -d --remove-orphans

echo "Dangling image болон ашиглагдахгүй build cache цэвэрлэж байна..."
docker image prune -f
docker builder prune -f

compose ps
