#!/bin/bash
# Deploy AFIP Edge Function to Supabase
# Usage: ./scripts/deploy-edge-function.sh [project-ref] [access-token]

set -e

PROJECT_REF="${1:-zkfxtndbppprvjldzihx}"
ACCESS_TOKEN="${2:-$SUPABASE_ACCESS_TOKEN}"

if [ -z "$ACCESS_TOKEN" ]; then
    echo "Error: Access token required."
    echo "Usage: ./scripts/deploy-edge-function.sh [project-ref] [access-token]"
    echo "   or: SUPABASE_ACCESS_TOKEN=xxx ./scripts/deploy-edge-function.sh"
    exit 1
fi

# Find supabase CLI
SUPABASE_CLI=$(which supabase 2>/dev/null || echo "$HOME/.local/bin/supabase")
if [ ! -x "$SUPABASE_CLI" ]; then
    echo "Error: supabase CLI not found. Install: https://supabase.com/docs/guides/cli"
    exit 1
fi

echo "Deploying AFIP Edge Function..."
echo "  Project: $PROJECT_REF"
echo "  CLI:     $SUPABASE_CLI"

SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN" "$SUPABASE_CLI" functions deploy afip \
    --no-verify-jwt \
    --project-ref "$PROJECT_REF"

echo ""
echo "Setting ENCRYPTION_KEY secret..."

# Read ENCRYPTION_KEY from .env if not already set
ENCRYPTION_KEY="${ENCRYPTION_KEY:-$(grep '^ENCRYPTION_KEY=' .env 2>/dev/null | cut -d= -f2-)}"
if [ -z "$ENCRYPTION_KEY" ]; then
    echo "Warning: ENCRYPTION_KEY not found in .env — skipping secret setup."
else
    SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN" "$SUPABASE_CLI" secrets set \
        "ENCRYPTION_KEY=$ENCRYPTION_KEY" \
        --project-ref "$PROJECT_REF"
    echo "ENCRYPTION_KEY set."
fi

echo ""
echo "Done! Function URL: https://$PROJECT_REF.supabase.co/functions/v1/afip"
echo "Dashboard: https://supabase.com/dashboard/project/$PROJECT_REF/functions"
