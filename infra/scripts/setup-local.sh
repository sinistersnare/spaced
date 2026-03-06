#!/bin/bash
# Setup script for local Spaced + Roomy development environment.
# Creates the Docker network, starts infrastructure services, and provisions
# bot/teacher/student accounts on the local PDS.
#
# Prerequisites: Docker, docker compose, jq, curl
# Run from the infra/ directory: bash scripts/setup-local.sh

set -e

PDS_URL="http://localhost:2583"
ADMIN_PASSWORD="pwpw"

echo "Setting up Spaced local development environment..."

# Ensure roomy-dev network exists
if ! docker network inspect roomy-dev >/dev/null 2>&1; then
    echo "Creating roomy-dev Docker network..."
    docker network create roomy-dev
fi

# Start infrastructure services
echo "Starting infrastructure services..."
docker compose up -d caddy plc-db plc-directory leaf-server pds

# Wait for PDS to be healthy
echo "Waiting for PDS to be ready..."
for i in $(seq 1 30); do
    if curl -sf "$PDS_URL/xrpc/_health" >/dev/null 2>&1; then
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "PDS did not become healthy in time. Check: docker compose logs pds"
        exit 1
    fi
    sleep 2
done

echo "Service health:"
echo "  PDS:     $(curl -s "$PDS_URL/xrpc/_health" | jq -r .version 2>/dev/null || echo 'unknown')"
echo "  PLC:     $(curl -s "http://localhost:3001/_health" | jq -r .version 2>/dev/null || echo 'unknown')"
echo "  Leaf:    $(curl -sf "http://localhost:5530" >/dev/null 2>&1 && echo 'up' || echo 'starting...')"

# Generate an invite code (useCount=10 to cover all accounts + retries)
echo ""
echo "Generating invite code..."
INVITE_CODE=$(curl -s -X POST \
    -u "admin:${ADMIN_PASSWORD}" \
    -H "Content-Type: application/json" \
    -d '{"useCount": 10}' \
    "${PDS_URL}/xrpc/com.atproto.server.createInviteCode" | jq -r .code)

if [ -z "$INVITE_CODE" ] || [ "$INVITE_CODE" = "null" ]; then
    echo "Failed to generate invite code. Check PDS logs: docker compose logs pds"
    exit 1
fi

# Helper: create an account, print DID, return DID in variable $ACCOUNT_DID
create_account() {
    local handle="$1"
    local email="$2"
    local password="$3"

    RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{
          \"email\": \"${email}\",
          \"handle\": \"${handle}\",
          \"password\": \"${password}\",
          \"inviteCode\": \"${INVITE_CODE}\"
        }" \
        "${PDS_URL}/xrpc/com.atproto.server.createAccount")

    ACCOUNT_DID=$(echo "$RESPONSE" | jq -r .did 2>/dev/null)

    if [ -z "$ACCOUNT_DID" ] || [ "$ACCOUNT_DID" = "null" ]; then
        echo "  Warning: could not create ${handle} (may already exist)"
        echo "  Response: $(echo "$RESPONSE" | jq -r .message 2>/dev/null || echo "$RESPONSE")"
        ACCOUNT_DID=""
    else
        echo "  Created: ${handle} (${ACCOUNT_DID})"
    fi
}

echo ""
echo "Creating accounts..."
create_account "spaced-bot.localhost"  "spaced-bot@example.com"  "password123"; BOT_DID="$ACCOUNT_DID"
create_account "teacher.localhost"     "teacher@example.com"     "password123"; TEACHER_DID="$ACCOUNT_DID"
create_account "student.localhost"     "student@example.com"     "password123"; STUDENT_DID="$ACCOUNT_DID"

echo ""
echo "================================================================"
echo " Setup complete!"
echo "================================================================"
echo ""
echo "URLs:"
echo "  PDS (direct):   http://localhost:2583"
echo "  PDS (Caddy):    https://localhost"
echo "  Roomy app:      https://app.localhost  (start separately — see below)"
echo "  Leaf server:    http://localhost:5530"
echo ""
echo "Test accounts (password: password123):"
echo "  Bot:     spaced-bot.localhost  ${BOT_DID}"
echo "  Teacher: teacher.localhost     ${TEACHER_DID}"
echo "  Student: student.localhost     ${STUDENT_DID}"
echo ""
echo "Add the following to .env.local at the repo root:"
echo "----------------------------------------------------------------"
echo "BOT_DID=${BOT_DID}"
echo "BOT_APP_PASSWORD=password123"
echo "PDS_URL=http://localhost:2583"
echo "LEAF_URL=https://app.localhost/leaf"
echo "LEAF_SERVER_DID=did:web:app.localhost"
echo "----------------------------------------------------------------"
echo ""
echo "To start the Roomy web app (required for https://app.localhost):"
echo "  cd ~/github.com/muni-town/roomy && pnpm dev"
echo ""
echo "To trust the local Caddy CA cert (one-time, enables https://localhost):"
echo "  docker compose exec caddy caddy trust"
echo ""
echo "To start the bot:"
echo "  pnpm --filter lab-bridge dev   (from the spaced repo root)"
echo ""
