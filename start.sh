#!/bin/sh
# Start backend on port 4000 in background
node /app/backend/index.js &

# Start nginx (serves frontend + proxies /api)
nginx -g "daemon off;"
