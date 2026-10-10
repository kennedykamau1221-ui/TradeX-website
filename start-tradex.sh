#!/bin/sh
cd "$(dirname "$0")"
npm install || exit 1
(sleep 2; open http://localhost:8787 2>/dev/null || xdg-open http://localhost:8787 2>/dev/null || true) &
npm start
