#!/usr/bin/env bash
# Updates the live site without taking it down. Run it on the server:
#   ~/night-prod/server/scripts/deploy.sh            # latest commit of the current branch
#   ~/night-prod/server/scripts/deploy.sh main       # or a named branch
#
# 1. Backs up the database and covers.
# 2. Builds the new version while the old one keeps serving.
# 3. Applies database migrations. They must work with the old code too (see DEPLOY.md).
# 4. For api, then web: starts a second container on the new version, waits until it is
#    healthy, then stops the old one gracefully. The edge proxy retries refused
#    connections on the other container, so visitors never see an error.
# If a new container never turns healthy it is removed and the old one keeps serving.
# The database container is never touched.
set -euo pipefail
cd "$(dirname "$0")/.."

branch="${1:-$(git rev-parse --abbrev-ref HEAD)}"
log() { echo "$(date +%T) $*"; }

if [ -x "$HOME/bin/nightingale-backup.sh" ]; then
  log "backing up"
  "$HOME/bin/nightingale-backup.sh"
fi

log "fetching $branch"
git fetch -q origin "$branch"
git checkout -q -B "$branch" "origin/$branch"
log "deploying $(git log --oneline -1)"

log "building (the site keeps running on the current version)"
docker compose build -q migrate api web > /dev/null

log "migrating the database"
docker compose run --rm --no-deps migrate > /dev/null 2>&1

# The edge owns the public port and is only created here, never replaced.
docker compose up -d --no-deps --no-recreate edge > /dev/null 2>&1

roll() {
  local svc=$1 old new status=starting count
  old=$(docker compose ps -q "$svc")
  if [ -z "$old" ]; then
    log "$svc wasn't running; starting it"
    docker compose up -d --no-deps "$svc" > /dev/null 2>&1
    return
  fi
  count=$(wc -l <<< "$old")

  log "starting the new $svc"
  docker compose up -d --no-deps --no-recreate --scale "$svc=$((count + 1))" "$svc" > /dev/null 2>&1
  new=$(docker compose ps -q "$svc" | grep -vxF -f <(echo "$old"))

  for _ in $(seq 1 120); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$new")
    [ "$status" = healthy ] || [ "$status" = unhealthy ] && break
    sleep 1
  done
  if [ "$status" != healthy ]; then
    log "the new $svc isn't healthy ($status), so the current one stays live. Its last logs:"
    docker logs --tail 40 "$new" || true
    docker rm -f "$new" > /dev/null
    exit 1
  fi

  # nginx caches container addresses for 2s; let it learn the new one before the old goes.
  sleep 4
  log "retiring the old $svc"
  # SIGTERM: the old container finishes the requests it has, then exits.
  # shellcheck disable=SC2086
  docker stop -t 20 $old > /dev/null
  # shellcheck disable=SC2086
  docker rm $old > /dev/null
}

roll api
roll web

port=$(docker compose port edge 80)
if curl -fsS -o /dev/null "http://127.0.0.1:${port##*:}/api/health"; then
  log "done: the site is live on the new version"
else
  log "warning: the health check through the edge failed; check 'docker compose ps'"
  exit 1
fi
