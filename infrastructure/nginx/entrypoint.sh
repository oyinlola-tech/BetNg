#!/bin/sh
# Validates the public origins, renders the security headers and starts nginx. Fails closed on bad input.
set -euf

fail() {
  echo "betng-frontend: $1" >&2
  exit 1
}

insecure="${BETNG_ALLOW_INSECURE_ORIGINS:-false}"
case "$insecure" in true | false) ;; *) fail "BETNG_ALLOW_INSECURE_ORIGINS must be true or false" ;; esac

# $1 variable name, $2 value, $3 allowed schemes (space separated)
check_origins() {
  for origin in $(printf '%s' "$2" | tr ',' ' '); do
    scheme="${origin%%://*}"
    allowed=false
    for candidate in $3; do [ "$scheme" = "$candidate" ] && allowed=true; done
    [ "$allowed" = true ] || fail "$1: scheme '$scheme' is not allowed"
    printf '%s' "$origin" | grep -Eq '^[a-z]+://(\*\.)?[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*(:[0-9]{1,5})?$' \
      || fail "$1: '$origin' is not a bare origin (scheme://host[:port])"
  done
}

origins() { printf '%s' "$1" | tr ',' ' ' | tr -s ' ' | sed 's/^ //; s/ $//'; }

if [ "$insecure" = true ]; then
  http_schemes="https http"
  ws_schemes="wss https ws http"
else
  http_schemes="https"
  ws_schemes="wss https"
fi

[ -n "${BETNG_API_ORIGIN:-}" ] || fail "BETNG_API_ORIGIN is required"
[ -n "${BETNG_WS_ORIGIN:-}" ] || fail "BETNG_WS_ORIGIN is required"
check_origins BETNG_API_ORIGIN "$BETNG_API_ORIGIN" "$http_schemes"
check_origins BETNG_WS_ORIGIN "$BETNG_WS_ORIGIN" "$ws_schemes"
check_origins BETNG_UPLOAD_ORIGINS "${BETNG_UPLOAD_ORIGINS:-}" "$http_schemes"
check_origins BETNG_CHECKOUT_ORIGINS "${BETNG_CHECKOUT_ORIGINS:-}" "$http_schemes"
check_origins BETNG_IMG_ORIGINS "${BETNG_IMG_ORIGINS:-}" "$http_schemes"

hashes=/etc/nginx/betng/csp
script_hashes="$(cat "$hashes/script-hashes")"
style_hashes="$(cat "$hashes/style-hashes")"
style_attr_hashes="$(cat "$hashes/style-attr-hashes")"

if [ -n "$style_attr_hashes" ]; then
  style_attr="'unsafe-hashes' $style_attr_hashes"
else
  style_attr="'none'"
fi

connect="'self' $(origins "$BETNG_API_ORIGIN") $(origins "$BETNG_WS_ORIGIN") $(origins "${BETNG_UPLOAD_ORIGINS:-}")"
csp="default-src 'none'"
csp="$csp; script-src 'self' $script_hashes"
csp="$csp; style-src 'self' $style_hashes"
csp="$csp; style-src-attr $style_attr"
csp="$csp; img-src 'self' $(origins "${BETNG_IMG_ORIGINS:-}")"
csp="$csp; font-src 'self'"
csp="$csp; connect-src $connect"
csp="$csp; manifest-src 'self'"
csp="$csp; object-src 'none'"
csp="$csp; base-uri 'none'"
csp="$csp; form-action 'self' $(origins "${BETNG_CHECKOUT_ORIGINS:-}")"
csp="$csp; frame-ancestors 'none'"
[ "$insecure" = true ] || csp="$csp; upgrade-insecure-requests"
BETNG_CSP="$(printf '%s' "$csp" | tr -s ' ' | sed 's/ ;/;/g')"

case "${BETNG_APP:-}" in
  admin | shop) BETNG_ROBOTS_TAG="noindex, nofollow" ;;
  web | tv) BETNG_ROBOTS_TAG="" ;;
  *) fail "BETNG_APP must be web, tv, shop or admin" ;;
esac

export BETNG_CSP BETNG_ROBOTS_TAG
mkdir -p /tmp/nginx
envsubst '${BETNG_CSP} ${BETNG_ROBOTS_TAG}' \
  < /etc/nginx/betng/security-headers.conf.template \
  > /tmp/nginx/security-headers.conf

exec nginx -g 'daemon off;'
