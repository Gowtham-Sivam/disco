#!/bin/bash
# Disco Campaign Builder — convenience commands
# Usage: source commands.sh
# Then: br / bs / fr / fs

DISCO_DIR="/Users/gowthamsivam/Desktop/Proj/disco"

br() {
  echo "Starting backend..."
  cd "$DISCO_DIR/backend" || return 1
  source venv/bin/activate
  uvicorn main:app --reload --port 8000 > /tmp/disco_backend.log 2>&1 &
  echo "Backend running on http://localhost:8000  (logs: /tmp/disco_backend.log)"
}

bs() {
  lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "Backend stopped." || echo "Backend was not running."
}

fr() {
  echo "Starting frontend..."
  cd "$DISCO_DIR" || return 1
  npm run dev > /tmp/disco_frontend.log 2>&1 &
  echo "Frontend running on http://localhost:3000  (logs: /tmp/disco_frontend.log)"
}

fs() {
  lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "Frontend stopped." || echo "Frontend was not running."
}

blog() { tail -f /tmp/disco_backend.log; }
flog() { tail -f /tmp/disco_frontend.log; }
