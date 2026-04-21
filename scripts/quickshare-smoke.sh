#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SMOKE_UP="${SMOKE_UP:-0}"
SMOKE_DOCKER_PS="${SMOKE_DOCKER_PS:-1}"
SMOKE_MODE="${SMOKE_MODE:-host}"
SMOKE_DOCKER_CONTAINER="${SMOKE_DOCKER_CONTAINER:-quickshare-app-1}"
SMOKE_FILE_MANAGEMENT="${SMOKE_FILE_MANAGEMENT:-1}"
SMOKE_FILE_TRANSFER="${SMOKE_FILE_TRANSFER:-1}"
SMOKE_PAYMENT_FLOW="${SMOKE_PAYMENT_FLOW:-1}"
CURL_MAX_TIME="${CURL_MAX_TIME:-10}"

log() {
  printf '[smoke] %s\n' "$*"
}

fail() {
  printf '[smoke] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"
}

wait_for_health_ready() {
  local attempts="${SMOKE_HEALTH_ATTEMPTS:-30}"
  local sleep_seconds="${SMOKE_HEALTH_SLEEP_SECONDS:-2}"
  local body=""

  for ((i = 1; i <= attempts; i++)); do
    body="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/health" 2>/dev/null || true)"
    if [[ "$body" == *'"status":"UP"'* && "$body" == *'"database":"UP"'* && "$body" == *'"redis":"UP"'* ]]; then
      return 0
    fi
    sleep "$sleep_seconds"
  done

  fail "health endpoint did not become ready after ${attempts} attempts"
}

read_dotenv_var() {
  local key="$1"

  if [[ -f .env ]]; then
    sed -n "s/^${key}=//p" .env | head -n 1
  fi
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

run_curl() {
  if [[ "$SMOKE_MODE" == "container" ]]; then
    docker exec "$SMOKE_DOCKER_CONTAINER" curl "$@"
  else
    curl "$@"
  fi
}

compose_cmd() {
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    docker compose "$@"
  fi
}

get_body() {
  run_curl -sS --max-time "$CURL_MAX_TIME" "$1"
}

get_code() {
  run_curl -sS --max-time "$CURL_MAX_TIME" -o /dev/null -w '%{http_code}' "$1"
}

post_json() {
  local url="$1"
  local payload="$2"
  run_curl -sS --max-time "$CURL_MAX_TIME" -H 'Content-Type: application/json' -d "$payload" "$url"
}

assert_contains() {
  local body="$1"
  local needle="$2"
  local description="$3"

  if [[ "$body" != *"$needle"* ]]; then
    fail "$description"
  fi
}

assert_not_contains() {
  local body="$1"
  local needle="$2"
  local description="$3"

  if [[ "$body" == *"$needle"* ]]; then
    fail "$description"
  fi
}

extract_data_id() {
  printf '%s' "$1" | sed -n 's/.*"data":{"id":\([0-9][0-9]*\).*/\1/p'
}

extract_json_string() {
  local body="$1"
  local key="$2"
  printf '%s' "$body" | sed -n "s/.*\"${key}\":\"\\([^\"]*\\)\".*/\\1/p"
}

extract_json_number() {
  local body="$1"
  local key="$2"
  printf '%s' "$body" | sed -n "s/.*\"${key}\":\\([0-9][0-9]*\\).*/\\1/p"
}

extract_json_decimal() {
  local body="$1"
  local key="$2"
  printf '%s' "$body" | sed -n "s/.*\"${key}\":\\([0-9][0-9]*\\(\\.[0-9][0-9]*\\)\\?\\).*/\\1/p"
}

extract_url_param() {
  local url="$1"
  local key="$2"
  printf '%s' "$url" | sed -n "s/.*[?&]${key}=\\([^&]*\\).*/\\1/p"
}

md5_hex() {
  printf '%s' "$1" | md5sum | awk '{print $1}'
}

assert_known_risk_level() {
  local value="$1"
  local description="$2"

  case "$value" in
    healthy|warning|critical|unknown)
      ;;
    *)
      fail "$description"
      ;;
  esac
}

cleanup_smoke_resources() {
  local status=$?
  trap - EXIT

  if [[ -n "${token:-}" ]]; then
    if [[ -n "${cleanup_payment_order_id:-}" ]]; then
      run_curl -sS --max-time "$CURL_MAX_TIME" -X PUT \
        "${BASE_URL}/api/admin/orders/${cleanup_payment_order_id}/mark-refunded" \
        -H "Authorization: Bearer ${token}" >/dev/null || true
      run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
        "${BASE_URL}/api/admin/orders/${cleanup_payment_order_id}" \
        -H "Authorization: Bearer ${token}" >/dev/null || true
    fi

    if [[ -n "${cleanup_payment_provider_id:-}" ]]; then
      run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
        "${BASE_URL}/api/admin/payment-providers/${cleanup_payment_provider_id}" \
        -H "Authorization: Bearer ${token}" >/dev/null || true
    fi

    if [[ -n "${cleanup_payment_plan_id:-}" ]]; then
      run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
        "${BASE_URL}/api/admin/plans/${cleanup_payment_plan_id}" \
        -H "Authorization: Bearer ${token}" >/dev/null || true
    fi

    if [[ -n "${cleanup_batch_target_folder_id:-}" ]]; then
      run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
        "${BASE_URL}/api/folders/${cleanup_batch_target_folder_id}" \
        -H "Authorization: Bearer ${token}" >/dev/null || true
    fi

    if [[ -n "${cleanup_parent_folder_id:-}" ]]; then
      run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
        "${BASE_URL}/api/folders/${cleanup_parent_folder_id}" \
        -H "Authorization: Bearer ${token}" >/dev/null || true
    fi

    if [[ -n "${cleanup_child_folder_id:-}" ]]; then
      run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
        "${BASE_URL}/api/folders/${cleanup_child_folder_id}" \
        -H "Authorization: Bearer ${token}" >/dev/null || true
    fi
  fi

  if [[ -n "${cleanup_temp_dir:-}" && -d "${cleanup_temp_dir}" ]]; then
    rm -rf "${cleanup_temp_dir}"
  fi

  exit "$status"
}

require_cmd curl
require_cmd sed
if [[ "$SMOKE_PAYMENT_FLOW" == "1" ]]; then
  require_cmd md5sum
  require_cmd awk
fi

APP_PORT="${APP_PORT:-$(read_dotenv_var APP_PORT)}"
APP_PORT="${APP_PORT:-8080}"
BOOTSTRAP_ADMIN_USERNAME_VALUE="${BOOTSTRAP_ADMIN_USERNAME:-$(read_dotenv_var BOOTSTRAP_ADMIN_USERNAME)}"
BOOTSTRAP_ADMIN_PASSWORD_VALUE="${BOOTSTRAP_ADMIN_PASSWORD:-$(read_dotenv_var BOOTSTRAP_ADMIN_PASSWORD)}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${APP_PORT}}"
ADMIN_USERNAME="${ADMIN_USERNAME:-${BOOTSTRAP_ADMIN_USERNAME_VALUE:-admin}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-${BOOTSTRAP_ADMIN_PASSWORD_VALUE:-}}"

if [[ "$SMOKE_MODE" != "host" && "$SMOKE_MODE" != "container" ]]; then
  fail "SMOKE_MODE must be 'host' or 'container'"
fi

if [[ "$SMOKE_UP" == "1" || "$SMOKE_DOCKER_PS" == "1" || "$SMOKE_MODE" == "container" ]]; then
  require_cmd docker
fi

if [[ "$SMOKE_UP" == "1" ]]; then
  log "docker compose up --build -d"
  compose_cmd up --build -d
  log "wait for /api/health readiness"
  wait_for_health_ready
fi

if [[ "$SMOKE_DOCKER_PS" == "1" ]]; then
  log "docker compose ps"
  compose_cmd ps
fi

cleanup_parent_folder_id=""
cleanup_child_folder_id=""
cleanup_batch_target_folder_id=""
cleanup_payment_order_id=""
cleanup_payment_plan_id=""
cleanup_payment_provider_id=""
cleanup_temp_dir=""
trap cleanup_smoke_resources EXIT

log "GET /api/health"
health_body="$(get_body "${BASE_URL}/api/health")"
assert_contains "$health_body" '"status":"UP"' "health endpoint did not report UP"
assert_contains "$health_body" '"database":"UP"' "health endpoint did not report database UP"
assert_contains "$health_body" '"redis":"UP"' "health endpoint did not report redis UP"
health_storage_mode="$(extract_json_string "$health_body" "storage")"
if [[ "$health_storage_mode" == "local" ]]; then
  assert_contains "$health_body" '"storageUploadDir"' "health endpoint did not expose storageUploadDir for local storage"
  assert_contains "$health_body" '"storageUploadDirExists"' "health endpoint did not expose storageUploadDirExists for local storage"
  assert_contains "$health_body" '"storageDiskUsablePercent"' "health endpoint did not expose storageDiskUsablePercent for local storage"
  assert_contains "$health_body" '"storageDiskRiskLevel"' "health endpoint did not expose storageDiskRiskLevel for local storage"
  health_upload_dir="$(extract_json_string "$health_body" "storageUploadDir")"
  health_storage_risk="$(extract_json_string "$health_body" "storageDiskRiskLevel")"
  health_storage_percent="$(extract_json_decimal "$health_body" "storageDiskUsablePercent")"
  [[ -n "$health_upload_dir" ]] || fail "health endpoint returned empty storageUploadDir"
  [[ -n "$health_storage_percent" ]] || fail "health endpoint returned empty storageDiskUsablePercent"
  assert_known_risk_level "$health_storage_risk" "health endpoint returned unknown storageDiskRiskLevel"
fi

log "GET /api/public/plans"
plans_body="$(get_body "${BASE_URL}/api/public/plans")"
assert_contains "$plans_body" '"data":[' "public plans endpoint did not return a list"

log "GET /api/public/payment-options"
payment_options_body="$(get_body "${BASE_URL}/api/public/payment-options")"
if [[ "$payment_options_body" == *'"data":null'* ]]; then
  log "payment options: no enabled default provider, purchase entry should stay disabled"
else
  assert_contains "$payment_options_body" '"payTypes"' "payment options endpoint did not expose payTypes"
fi

log "GET /api/public/registration-settings"
registration_body="$(get_body "${BASE_URL}/api/public/registration-settings")"
assert_contains "$registration_body" '"captchaProvider"' "registration settings endpoint did not expose captchaProvider"

log "GET /pricing.html"
pricing_code="$(get_code "${BASE_URL}/pricing.html")"
[[ "$pricing_code" == "200" ]] || fail "pricing.html returned HTTP ${pricing_code}"

log "GET /payment-result.html"
payment_result_code="$(get_code "${BASE_URL}/payment-result.html")"
[[ "$payment_result_code" == "200" ]] || fail "payment-result.html returned HTTP ${payment_result_code}"

if [[ -n "$ADMIN_USERNAME" && -n "$ADMIN_PASSWORD" ]]; then
  log "POST /api/auth/login"
  login_payload="$(printf '{"username":"%s","password":"%s"}' "$(json_escape "$ADMIN_USERNAME")" "$(json_escape "$ADMIN_PASSWORD")")"
  login_body="$(post_json "${BASE_URL}/api/auth/login" "$login_payload")"
  token="$(printf '%s' "$login_body" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  [[ -n "$token" ]] || fail "login succeeded without a token payload"

  log "GET /api/profile"
  profile_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/profile" -H "Authorization: Bearer ${token}")"
  assert_contains "$profile_body" "\"username\":\"${ADMIN_USERNAME}\"" "profile endpoint did not return the expected user"

  log "GET /api/admin/settings/storage"
  storage_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/admin/settings/storage" -H "Authorization: Bearer ${token}")"
  assert_contains "$storage_body" '"connectionStatus"' "storage settings endpoint did not return runtime status"
  storage_type="$(extract_json_string "$storage_body" "type")"
  if [[ "$storage_type" == "local" ]]; then
    assert_contains "$storage_body" '"localUploadDir"' "storage settings endpoint did not expose localUploadDir"
    assert_contains "$storage_body" '"localDiskUsablePercent"' "storage settings endpoint did not expose localDiskUsablePercent"
    assert_contains "$storage_body" '"localDiskRiskLevel"' "storage settings endpoint did not expose localDiskRiskLevel"
    storage_local_upload_dir="$(extract_json_string "$storage_body" "localUploadDir")"
    storage_local_risk="$(extract_json_string "$storage_body" "localDiskRiskLevel")"
    storage_local_percent="$(extract_json_decimal "$storage_body" "localDiskUsablePercent")"
    [[ -n "$storage_local_upload_dir" ]] || fail "storage settings endpoint returned empty localUploadDir"
    [[ -n "$storage_local_percent" ]] || fail "storage settings endpoint returned empty localDiskUsablePercent"
    assert_known_risk_level "$storage_local_risk" "storage settings endpoint returned unknown localDiskRiskLevel"

    if [[ "${health_storage_mode:-}" == "local" ]]; then
      [[ "$storage_local_upload_dir" == "$health_upload_dir" ]] || fail "storage settings endpoint localUploadDir did not match health storageUploadDir"
      [[ "$storage_local_risk" == "$health_storage_risk" ]] || fail "storage settings endpoint localDiskRiskLevel did not match health storageDiskRiskLevel"
    fi
  fi

  log "GET /api/payment/orders"
  orders_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/payment/orders" -H "Authorization: Bearer ${token}")"
  assert_contains "$orders_body" '"data":[' "payment orders endpoint did not return a list"

  if [[ "$SMOKE_PAYMENT_FLOW" == "1" ]]; then
    payment_smoke_stamp="$(date +%s)-$$"
    payment_plan_name="Smoke Payment Plan ${payment_smoke_stamp}"
    payment_provider_name="Smoke Payment Provider ${payment_smoke_stamp}"
    payment_provider_pid="smoke-pid-${payment_smoke_stamp}"
    payment_provider_key="smoke-key-${payment_smoke_stamp}"
    payment_provider_api="https://smoke-pay-${payment_smoke_stamp}.example.com"

    log "GET /api/profile (before payment flow)"
    payment_profile_before="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/profile" -H "Authorization: Bearer ${token}")"
    payment_storage_limit_before="$(extract_json_number "$payment_profile_before" "storageLimit")"
    [[ -n "$payment_storage_limit_before" ]] || fail "profile did not expose storageLimit before payment flow"

    log "POST /api/admin/plans (payment smoke plan)"
    payment_plan_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X POST \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer ${token}" \
      -d "{\"name\":\"${payment_plan_name}\",\"description\":\"Smoke payment flow plan\",\"type\":\"storage\",\"value\":2048,\"price\":0.88,\"sortOrder\":999,\"status\":1}" \
      "${BASE_URL}/api/admin/plans")"
    cleanup_payment_plan_id="$(extract_data_id "$payment_plan_body")"
    [[ -n "$cleanup_payment_plan_id" ]] || fail "failed to create payment smoke plan"

    log "POST /api/admin/payment-providers (payment smoke provider)"
    payment_provider_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X POST \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer ${token}" \
      -d "{\"name\":\"${payment_provider_name}\",\"apiUrl\":\"${payment_provider_api}\",\"pid\":\"${payment_provider_pid}\",\"merchantKey\":\"${payment_provider_key}\",\"payTypes\":\"alipay\",\"enabled\":1,\"sortOrder\":999}" \
      "${BASE_URL}/api/admin/payment-providers")"
    cleanup_payment_provider_id="$(extract_data_id "$payment_provider_body")"
    [[ -n "$cleanup_payment_provider_id" ]] || fail "failed to create payment smoke provider"

    log "POST /api/payment/create (payment smoke order)"
    payment_create_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X POST \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer ${token}" \
      -d "{\"planId\":${cleanup_payment_plan_id},\"providerId\":${cleanup_payment_provider_id},\"payType\":\"alipay\",\"returnUrl\":\"${BASE_URL}/payment-result.html\"}" \
      "${BASE_URL}/api/payment/create")"
    payment_redirect_url="$(extract_json_string "$payment_create_body" "redirectUrl")"
    [[ -n "$payment_redirect_url" ]] || fail "payment create did not return redirectUrl"
    assert_contains "$payment_redirect_url" "${payment_provider_api}/submit.php?" "payment create did not use the configured provider api url"
    assert_contains "$payment_redirect_url" "notify_url=http%3A%2F%2F127.0.0.1%3A${APP_PORT}%2Fapi%2Fpayment%2Fnotify" "payment create did not embed localhost notify url"
    assert_contains "$payment_redirect_url" "return_url=http%3A%2F%2F127.0.0.1%3A${APP_PORT}%2Fpayment-result.html" "payment create did not embed localhost return url"

    payment_order_no="$(extract_url_param "$payment_redirect_url" "out_trade_no")"
    [[ -n "$payment_order_no" ]] || fail "payment redirectUrl did not include out_trade_no"

    log "GET /api/payment/order/{orderNo} (pending)"
    payment_order_pending_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" \
      "${BASE_URL}/api/payment/order/${payment_order_no}" \
      -H "Authorization: Bearer ${token}")"
    assert_contains "$payment_order_pending_body" "\"orderNo\":\"${payment_order_no}\"" "created payment order not found in user order api"
    assert_contains "$payment_order_pending_body" '"status":"pending"' "created payment order was not pending"
    cleanup_payment_order_id="$(extract_json_number "$payment_order_pending_body" "id")"
    [[ -n "$cleanup_payment_order_id" ]] || fail "created payment order did not expose id"

    payment_notify_trade_no="SMOKE-TRADE-${payment_smoke_stamp}"
    payment_notify_money="0.88"
    payment_notify_sign_base="money=${payment_notify_money}&out_trade_no=${payment_order_no}&pid=${payment_provider_pid}&trade_no=${payment_notify_trade_no}&trade_status=TRADE_SUCCESS${payment_provider_key}"
    payment_notify_sign="$(md5_hex "$payment_notify_sign_base")"

    log "POST /api/payment/notify"
    payment_notify_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X POST \
      -d "money=${payment_notify_money}" \
      -d "out_trade_no=${payment_order_no}" \
      -d "pid=${payment_provider_pid}" \
      -d "trade_no=${payment_notify_trade_no}" \
      -d "trade_status=TRADE_SUCCESS" \
      -d "sign=${payment_notify_sign}" \
      -d "sign_type=MD5" \
      "${BASE_URL}/api/payment/notify")"
    [[ "$payment_notify_body" == "success" ]] || fail "payment notify did not return success"

    log "GET /api/payment/order/{orderNo} (paid)"
    payment_order_paid_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" \
      "${BASE_URL}/api/payment/order/${payment_order_no}" \
      -H "Authorization: Bearer ${token}")"
    assert_contains "$payment_order_paid_body" '"status":"paid"' "payment order did not become paid after notify"

    log "GET /api/profile (after payment notify)"
    payment_profile_after_paid="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/profile" -H "Authorization: Bearer ${token}")"
    payment_storage_limit_after_paid="$(extract_json_number "$payment_profile_after_paid" "storageLimit")"
    [[ "$payment_storage_limit_after_paid" -eq $((payment_storage_limit_before + 2048)) ]] || fail "storageLimit did not increase after payment notify"

    log "PUT /api/admin/orders/{id}/mark-refunded"
    refund_order_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X PUT \
      -H "Authorization: Bearer ${token}" \
      "${BASE_URL}/api/admin/orders/${cleanup_payment_order_id}/mark-refunded")"
    assert_contains "$refund_order_body" '"code":200' "refund order endpoint did not return success"

    log "GET /api/payment/order/{orderNo} (refunded)"
    payment_order_refunded_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" \
      "${BASE_URL}/api/payment/order/${payment_order_no}" \
      -H "Authorization: Bearer ${token}")"
    assert_contains "$payment_order_refunded_body" '"status":"refunded"' "payment order did not become refunded after admin refund"

    log "GET /api/profile (after refund)"
    payment_profile_after_refund="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/profile" -H "Authorization: Bearer ${token}")"
    payment_storage_limit_after_refund="$(extract_json_number "$payment_profile_after_refund" "storageLimit")"
    [[ "$payment_storage_limit_after_refund" -eq "$payment_storage_limit_before" ]] || fail "storageLimit did not roll back after refund"

    log "DELETE /api/admin/orders/{id}"
    delete_payment_order_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
      -H "Authorization: Bearer ${token}" \
      "${BASE_URL}/api/admin/orders/${cleanup_payment_order_id}")"
    assert_contains "$delete_payment_order_body" '"code":200' "delete refunded payment order did not return success"
    cleanup_payment_order_id=""

    log "DELETE /api/admin/payment-providers/{id}"
    delete_payment_provider_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
      -H "Authorization: Bearer ${token}" \
      "${BASE_URL}/api/admin/payment-providers/${cleanup_payment_provider_id}")"
    assert_contains "$delete_payment_provider_body" '"code":200' "delete payment smoke provider did not return success"
    cleanup_payment_provider_id=""

    log "DELETE /api/admin/plans/{id}"
    delete_payment_plan_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
      -H "Authorization: Bearer ${token}" \
      "${BASE_URL}/api/admin/plans/${cleanup_payment_plan_id}")"
    assert_contains "$delete_payment_plan_body" '"code":200' "delete payment smoke plan did not return success"
    cleanup_payment_plan_id=""
  fi

  if [[ "$SMOKE_FILE_MANAGEMENT" == "1" ]]; then
    unique_suffix="$(date +%s)-$$"
    parent_folder_name="smoke-parent-${unique_suffix}"
    child_folder_name="smoke-child-${unique_suffix}"

    log "GET /api/files?folderId=0"
    root_files_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/files?folderId=0" -H "Authorization: Bearer ${token}")"
    assert_contains "$root_files_body" '"data":[' "root file listing did not return a list"

    log "POST /api/folders (parent)"
    create_parent_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -H 'Content-Type: application/json' \
      -d "{\"name\":\"${parent_folder_name}\",\"parentId\":0}" \
      "${BASE_URL}/api/folders" -H "Authorization: Bearer ${token}")"
    cleanup_parent_folder_id="$(extract_data_id "$create_parent_body")"
    [[ -n "$cleanup_parent_folder_id" ]] || fail "failed to create parent smoke folder"
    assert_contains "$create_parent_body" "\"name\":\"${parent_folder_name}\"" "parent smoke folder name missing from create response"

    log "POST /api/folders (child)"
    create_child_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -H 'Content-Type: application/json' \
      -d "{\"name\":\"${child_folder_name}\",\"parentId\":0}" \
      "${BASE_URL}/api/folders" -H "Authorization: Bearer ${token}")"
    cleanup_child_folder_id="$(extract_data_id "$create_child_body")"
    [[ -n "$cleanup_child_folder_id" ]] || fail "failed to create child smoke folder"
    assert_contains "$create_child_body" "\"name\":\"${child_folder_name}\"" "child smoke folder name missing from create response"

    log "GET /api/folders/all"
    all_folders_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/folders/all" -H "Authorization: Bearer ${token}")"
    assert_contains "$all_folders_body" "\"name\":\"${parent_folder_name}\"" "all folders listing did not include parent smoke folder"
    assert_contains "$all_folders_body" "\"name\":\"${child_folder_name}\"" "all folders listing did not include child smoke folder"

    log "PUT /api/folders/{id}/move"
    move_child_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X PUT -H 'Content-Type: application/json' \
      -d "{\"targetFolderId\":${cleanup_parent_folder_id}}" \
      "${BASE_URL}/api/folders/${cleanup_child_folder_id}/move" -H "Authorization: Bearer ${token}")"
    assert_contains "$move_child_body" '"code":200' "move folder endpoint did not return success"

    log "GET /api/files?folderId=<parent>"
    parent_listing_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/files?folderId=${cleanup_parent_folder_id}" -H "Authorization: Bearer ${token}")"
    assert_contains "$parent_listing_body" "\"name\":\"${child_folder_name}\"" "moved child folder did not appear inside the parent folder"

    if [[ "$SMOKE_FILE_TRANSFER" == "1" ]]; then
      if [[ "$SMOKE_MODE" != "host" ]]; then
        log "Skipping upload/download smoke in container mode"
      else
        cleanup_temp_dir="$(mktemp -d)"
        upload_source_file="${cleanup_temp_dir}/smoke-payload.txt"
        downloaded_file="${cleanup_temp_dir}/downloaded-payload.txt"
        payload_content="quickshare-smoke-payload-${unique_suffix}"
        first_upload_name="smoke-upload-${unique_suffix}.txt"
        second_upload_name="smoke-upload-copy-${unique_suffix}.txt"

        printf '%s\n' "$payload_content" > "$upload_source_file"

        log "GET /api/profile (before download)"
        profile_before_download="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/profile" -H "Authorization: Bearer ${token}")"
        download_used_before="$(extract_json_number "$profile_before_download" "downloadUsed")"
        [[ -n "$download_used_before" ]] || fail "profile did not expose downloadUsed before download smoke"

        log "POST /api/upload (first file)"
        upload_first_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" \
          -H "Authorization: Bearer ${token}" \
          -F "file=@${upload_source_file};type=text/plain;filename=${first_upload_name}" \
          -F "folderId=${cleanup_parent_folder_id}" \
          "${BASE_URL}/api/upload")"
        first_upload_id="$(extract_data_id "$upload_first_body")"
        first_upload_path="$(extract_json_string "$upload_first_body" "filePath")"
        [[ -n "$first_upload_id" ]] || fail "first upload did not return a file id"
        [[ -n "$first_upload_path" ]] || fail "first upload did not return a storage path"

        log "POST /api/upload (same file same name)"
        upload_second_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" \
          -H "Authorization: Bearer ${token}" \
          -F "file=@${upload_source_file};type=text/plain;filename=${first_upload_name}" \
          -F "folderId=${cleanup_parent_folder_id}" \
          "${BASE_URL}/api/upload")"
        second_upload_id="$(extract_data_id "$upload_second_body")"
        [[ "$second_upload_id" == "$first_upload_id" ]] || fail "same-name duplicate upload did not reuse the existing logical record"

        log "POST /api/upload (same content different name)"
        upload_third_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" \
          -H "Authorization: Bearer ${token}" \
          -F "file=@${upload_source_file};type=text/plain;filename=${second_upload_name}" \
          -F "folderId=${cleanup_parent_folder_id}" \
          "${BASE_URL}/api/upload")"
        third_upload_id="$(extract_data_id "$upload_third_body")"
        third_upload_path="$(extract_json_string "$upload_third_body" "filePath")"
        [[ -n "$third_upload_id" ]] || fail "third upload did not return a file id"
        [[ "$third_upload_id" != "$first_upload_id" ]] || fail "different-name duplicate upload should create a new logical record"
        [[ "$third_upload_path" == "$first_upload_path" ]] || fail "different-name duplicate upload did not reuse the same physical storage path"

        log "GET /api/files?folderId=<parent> (uploaded files)"
        parent_listing_with_uploads="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/files?folderId=${cleanup_parent_folder_id}" -H "Authorization: Bearer ${token}")"
        assert_contains "$parent_listing_with_uploads" "\"name\":\"${first_upload_name}\"" "parent folder listing did not include the first uploaded file"
        assert_contains "$parent_listing_with_uploads" "\"name\":\"${second_upload_name}\"" "parent folder listing did not include the second uploaded file"

        log "GET /api/files/{id}/download"
        curl -sS --max-time "$CURL_MAX_TIME" \
          "${BASE_URL}/api/files/${third_upload_id}/download" \
          -H "Authorization: Bearer ${token}" \
          -o "$downloaded_file"
        cmp -s "$upload_source_file" "$downloaded_file" || fail "downloaded file content did not match the uploaded payload"

        log "GET /api/profile (after download)"
        profile_after_download="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/profile" -H "Authorization: Bearer ${token}")"
        download_used_after="$(extract_json_number "$profile_after_download" "downloadUsed")"
        [[ -n "$download_used_after" ]] || fail "profile did not expose downloadUsed after download smoke"
        [[ "$download_used_after" -eq $((download_used_before + 1)) ]] || fail "downloadUsed did not increase after owned-file download"

        share_extract_code="5678"
        public_anonymous_file="${cleanup_temp_dir}/public-anonymous-download.txt"
        public_authenticated_file="${cleanup_temp_dir}/public-authenticated-download.txt"
        wrong_extract_body_file="${cleanup_temp_dir}/share-wrong-extract.json"

        log "POST /api/share"
        share_create_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -H 'Content-Type: application/json' \
          -d "{\"fileId\":${third_upload_id},\"extractCode\":\"${share_extract_code}\",\"expireHours\":1,\"maxDownload\":5}" \
          "${BASE_URL}/api/share" -H "Authorization: Bearer ${token}")"
        share_code="$(extract_json_string "$share_create_body" "shareCode")"
        [[ -n "$share_code" ]] || fail "share create did not return a share code"
        assert_contains "$share_create_body" "\"extractCode\":\"${share_extract_code}\"" "share create response did not return the expected extract code"

        log "GET /api/share/{shareCode} (wrong extract code)"
        wrong_extract_status="$(curl -sS --max-time "$CURL_MAX_TIME" \
          -o "$wrong_extract_body_file" \
          -w '%{http_code}' \
          "${BASE_URL}/api/share/${share_code}?extractCode=9999")"
        [[ "$wrong_extract_status" == "400" ]] || fail "share info with wrong extract code returned HTTP ${wrong_extract_status}"
        wrong_extract_body="$(cat "$wrong_extract_body_file")"
        assert_contains "$wrong_extract_body" '"message":"提取码错误"' "share info with wrong extract code did not return the expected message"

        log "GET /api/share/{shareCode} (correct extract code)"
        share_info_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" \
          "${BASE_URL}/api/share/${share_code}?extractCode=${share_extract_code}")"
        assert_contains "$share_info_body" "\"shareCode\":\"${share_code}\"" "share info did not return the expected share code"
        assert_contains "$share_info_body" "\"fileName\":\"${second_upload_name}\"" "share info did not return the expected file name"

        log "GET /api/download/{shareCode} (anonymous)"
        curl -sS --max-time "$CURL_MAX_TIME" \
          "${BASE_URL}/api/download/${share_code}?extractCode=${share_extract_code}" \
          -o "$public_anonymous_file"
        cmp -s "$upload_source_file" "$public_anonymous_file" || fail "anonymous public download content did not match the uploaded payload"

        log "GET /api/profile (after anonymous public download)"
        profile_after_anonymous_public_download="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/profile" -H "Authorization: Bearer ${token}")"
        download_used_after_anonymous_public_download="$(extract_json_number "$profile_after_anonymous_public_download" "downloadUsed")"
        [[ "$download_used_after_anonymous_public_download" -eq "$download_used_after" ]] || fail "anonymous public download unexpectedly changed the authenticated user's downloadUsed"

        log "GET /api/download/{shareCode} (authenticated)"
        curl -sS --max-time "$CURL_MAX_TIME" \
          "${BASE_URL}/api/download/${share_code}?extractCode=${share_extract_code}" \
          -H "Authorization: Bearer ${token}" \
          -o "$public_authenticated_file"
        cmp -s "$upload_source_file" "$public_authenticated_file" || fail "authenticated public download content did not match the uploaded payload"

        log "GET /api/profile (after authenticated public download)"
        profile_after_authenticated_public_download="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/profile" -H "Authorization: Bearer ${token}")"
        download_used_after_authenticated_public_download="$(extract_json_number "$profile_after_authenticated_public_download" "downloadUsed")"
        [[ -n "$download_used_after_authenticated_public_download" ]] || fail "profile did not expose downloadUsed after authenticated public download"
        [[ "$download_used_after_authenticated_public_download" -eq $((download_used_after + 1)) ]] || fail "authenticated public download did not increase downloadUsed"

        batch_target_folder_name="smoke-batch-target-${unique_suffix}"

        log "POST /api/folders (batch target)"
        create_batch_target_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -H 'Content-Type: application/json' \
          -d "{\"name\":\"${batch_target_folder_name}\",\"parentId\":0}" \
          "${BASE_URL}/api/folders" -H "Authorization: Bearer ${token}")"
        cleanup_batch_target_folder_id="$(extract_data_id "$create_batch_target_body")"
        [[ -n "$cleanup_batch_target_folder_id" ]] || fail "failed to create batch target smoke folder"

        log "PUT /api/files/{id}/move (batch item 1)"
        batch_move_file_one_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X PUT -H 'Content-Type: application/json' \
          -d "{\"targetFolderId\":${cleanup_batch_target_folder_id}}" \
          "${BASE_URL}/api/files/${first_upload_id}/move" -H "Authorization: Bearer ${token}")"
        assert_contains "$batch_move_file_one_body" '"code":200' "batch move for first file did not return success"

        log "PUT /api/files/{id}/move (batch item 2)"
        batch_move_file_two_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X PUT -H 'Content-Type: application/json' \
          -d "{\"targetFolderId\":${cleanup_batch_target_folder_id}}" \
          "${BASE_URL}/api/files/${third_upload_id}/move" -H "Authorization: Bearer ${token}")"
        assert_contains "$batch_move_file_two_body" '"code":200' "batch move for second file did not return success"

        log "PUT /api/folders/{id}/move (batch item 3)"
        batch_move_folder_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X PUT -H 'Content-Type: application/json' \
          -d "{\"targetFolderId\":${cleanup_batch_target_folder_id}}" \
          "${BASE_URL}/api/folders/${cleanup_child_folder_id}/move" -H "Authorization: Bearer ${token}")"
        assert_contains "$batch_move_folder_body" '"code":200' "batch move for child folder did not return success"

        log "GET /api/files?folderId=<parent> (after batch move)"
        parent_listing_after_batch_move="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/files?folderId=${cleanup_parent_folder_id}" -H "Authorization: Bearer ${token}")"
        assert_not_contains "$parent_listing_after_batch_move" "\"name\":\"${first_upload_name}\"" "parent folder still contains first uploaded file after batch move"
        assert_not_contains "$parent_listing_after_batch_move" "\"name\":\"${second_upload_name}\"" "parent folder still contains second uploaded file after batch move"
        assert_not_contains "$parent_listing_after_batch_move" "\"name\":\"${child_folder_name}\"" "parent folder still contains child folder after batch move"

        log "GET /api/files?folderId=<batch-target>"
        batch_target_listing_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/files?folderId=${cleanup_batch_target_folder_id}" -H "Authorization: Bearer ${token}")"
        assert_contains "$batch_target_listing_body" "\"name\":\"${first_upload_name}\"" "batch target folder did not include first uploaded file"
        assert_contains "$batch_target_listing_body" "\"name\":\"${second_upload_name}\"" "batch target folder did not include second uploaded file"
        assert_contains "$batch_target_listing_body" "\"name\":\"${child_folder_name}\"" "batch target folder did not include moved child folder"

        log "DELETE /api/files/{id} (batch delete item 1)"
        batch_delete_file_one_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
          "${BASE_URL}/api/files/${first_upload_id}" -H "Authorization: Bearer ${token}")"
        assert_contains "$batch_delete_file_one_body" '"code":200' "batch delete for first file did not return success"

        log "DELETE /api/files/{id} (batch delete item 2)"
        batch_delete_file_two_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
          "${BASE_URL}/api/files/${third_upload_id}" -H "Authorization: Bearer ${token}")"
        assert_contains "$batch_delete_file_two_body" '"code":200' "batch delete for second file did not return success"

        log "DELETE /api/folders/{id} (batch delete item 3)"
        batch_delete_folder_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
          "${BASE_URL}/api/folders/${cleanup_child_folder_id}" -H "Authorization: Bearer ${token}")"
        assert_contains "$batch_delete_folder_body" '"code":200' "batch delete for child folder did not return success"
        cleanup_child_folder_id=""

        log "GET /api/files?folderId=<batch-target> (after batch delete)"
        batch_target_listing_after_delete="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/files?folderId=${cleanup_batch_target_folder_id}" -H "Authorization: Bearer ${token}")"
        assert_not_contains "$batch_target_listing_after_delete" "\"name\":\"${first_upload_name}\"" "batch target folder still contains first uploaded file after batch delete"
        assert_not_contains "$batch_target_listing_after_delete" "\"name\":\"${second_upload_name}\"" "batch target folder still contains second uploaded file after batch delete"
        assert_not_contains "$batch_target_listing_after_delete" "\"name\":\"${child_folder_name}\"" "batch target folder still contains child folder after batch delete"

        log "DELETE /api/folders/{batchTargetId}"
        delete_batch_target_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
          "${BASE_URL}/api/folders/${cleanup_batch_target_folder_id}" \
          -H "Authorization: Bearer ${token}")"
        assert_contains "$delete_batch_target_body" '"code":200' "delete batch target folder endpoint did not return success"
        cleanup_batch_target_folder_id=""
      fi
    fi

    log "DELETE /api/folders/{parentId}"
    delete_parent_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" -X DELETE \
      "${BASE_URL}/api/folders/${cleanup_parent_folder_id}" \
      -H "Authorization: Bearer ${token}")"
    assert_contains "$delete_parent_body" '"code":200' "delete folder endpoint did not return success"
    cleanup_parent_folder_id=""
    cleanup_child_folder_id=""

    log "GET /api/files?folderId=0 (post-cleanup)"
    root_after_cleanup_body="$(run_curl -sS --max-time "$CURL_MAX_TIME" "${BASE_URL}/api/files?folderId=0" -H "Authorization: Bearer ${token}")"
    assert_not_contains "$root_after_cleanup_body" "\"name\":\"${parent_folder_name}\"" "parent smoke folder still exists after cleanup"
    assert_not_contains "$root_after_cleanup_body" "\"name\":\"${child_folder_name}\"" "child smoke folder still exists after cleanup"
    if [[ -n "${batch_target_folder_name:-}" ]]; then
      assert_not_contains "$root_after_cleanup_body" "\"name\":\"${batch_target_folder_name}\"" "batch target smoke folder still exists after cleanup"
    fi
  fi
else
  log "Skipping authenticated checks because bootstrap admin credentials are not configured"
fi

log "Smoke checks passed"
