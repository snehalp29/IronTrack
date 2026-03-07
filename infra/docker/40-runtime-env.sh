#!/bin/sh
set -eu

: "${VITE_API_URL:=http://localhost:3000/api/v1}"

envsubst '${VITE_API_URL}' \
  < /usr/share/nginx/html/runtime-env.js.template \
  > /usr/share/nginx/html/runtime-env.js
