#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8081}"
API_KEY="${API_KEY:-}"

auth_args=()
if [[ -n "${API_KEY}" ]]; then
  auth_args=(-H "x-api-key: ${API_KEY}")
fi

echo "Testing INTELLEUM API at ${BASE_URL}"

run_get() {
  local path="$1"
  local curl_args=()
  echo
  echo "GET ${path}"
  if [[ ${#auth_args[@]} -gt 0 ]]; then
    curl_args+=("${auth_args[@]}")
  fi
  curl -sS "${curl_args[@]}" "${BASE_URL}${path}"
  echo
}

run_post() {
  local path="$1"
  local payload="$2"
  local curl_args=()
  echo
  echo "POST ${path}"
  if [[ ${#auth_args[@]} -gt 0 ]]; then
    curl_args+=("${auth_args[@]}")
  fi
  curl -sS -X POST "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    "${curl_args[@]}" \
    -d "${payload}"
  echo
}

run_get "/health"
run_get "/api/streams/quicknode"
run_get "/api/stats"
run_get "/api/attacks?limit=10"
run_get "/api/attacks/history?limit=10"
run_get "/api/entities?limit=10"
run_get "/api/pools?limit=10"
run_get "/api/routes/risk?limit=10"
run_get "/api/routes/recommendations?limit=10"
run_get "/api/routes/policies?limit=10&objective=protect_users"
run_get "/api/analytics/execution-quality?limit=10"
run_get "/api/flows/segments"
run_get "/api/attribution/sources?limit=8"
run_get "/api/pools/lp-protection?limit=10"
run_get "/api/integrations/live-alerts?limit=10"
run_get "/api/integrations/feeds?limit=10"
run_get "/api/validators"
run_get "/api/validators/regimes?limit=10"
run_get "/api/savings/summary"
run_get "/api/prediction-markets/execution?limit=6"
run_get "/api/system/status"
run_get "/api/system/history"

run_post "/api/routes/evaluate" '{
  "input_mint": "So11111111111111111111111111111111111111112",
  "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "protocol": "raydium_amm",
  "notional_usd": 25000,
  "slippage_bps": 30,
  "objective": "protect_users"
}'

run_post "/api/routes/rank" '{
  "input_mint": "So11111111111111111111111111111111111111112",
  "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "notional_usd": 50000,
  "objective": "best_execution",
  "candidates": [
    { "route_key": "route:raydium_amm:SOL->USDC" },
    { "route_key": "venue:orca_whirlpool:SOL->USDC" },
    { "route_key": "route:meteora_dlmm:SOL->USDC" }
  ]
}'

run_post "/api/prevention/guard" '{
  "input_mint": "So11111111111111111111111111111111111111112",
  "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "notional_usd": 50000,
  "slippage_bps": 30,
  "objective": "protect_users"
}'

run_post "/api/access/request" '{
  "name": "Rachit",
  "email": "rachit@example.com",
  "organization": "Intelleum",
  "useCase": "platform evaluation",
  "message": "Smoke test"
}'

echo
echo "Done."
