# Security headers

The production path for the four browser apps (web, tv, shop, admin) is nginx in the frontend container
(`infrastructure/docker/web.Dockerfile`). Every header below is set by nginx with `always`, so it is also on
404 and 405 responses. `vite dev` and `vite preview` send none of them and carry no meta-tag CSP, so HMR keeps
working; do not treat `vite preview` as a production check.

Sources:

- `infrastructure/nginx/security-headers.conf.template`: the header set
- `infrastructure/nginx/entrypoint.sh`: builds the CSP and checks the configured origins at container start
- `infrastructure/nginx/csp-hashes.mjs`: hashes the inline code in the built `index.html` during the image build

## Headers

| Header                         | Value                                                                                                                                                                                        | Why                                                                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`      | See [CSP](#content-security-policy)                                                                                                                                                          | Limits scripts, styles and connections to the app itself and the configured platform origins.                                                                                                           |
| `Strict-Transport-Security`    | `max-age=63072000; includeSubDomains`                                                                                                                                                        | Keeps browsers on HTTPS for two years. Browsers ignore it over plain HTTP, so it only takes effect behind the TLS terminator. No `preload`: joining the preload list is a separate decision per domain. |
| `X-Content-Type-Options`       | `nosniff`                                                                                                                                                                                    | Stops the browser from guessing a MIME type, so an uploaded or mistyped file cannot run as script.                                                                                                      |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`                                                                                                                                                            | Other origins see only the origin, never the path (paths can contain ticket or match IDs).                                                                                                              |
| `Permissions-Policy`           | Every powerful feature `()` (camera, microphone, geolocation, payment, USB, sensors and the rest) except `fullscreen=(self)`                                                                 | None of the apps uses these APIs. The TV screen may go fullscreen.                                                                                                                                      |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                                                                                                                                                                | Cuts the `window.opener` link to other origins, which blocks tab-nabbing and cross-window leaks. Hosted checkout opens by redirect, not in a popup, so nothing depends on that link.                    |
| `Cross-Origin-Resource-Policy` | `same-origin`                                                                                                                                                                                | Other sites cannot embed the bundles or fonts.                                                                                                                                                          |
| `X-Frame-Options`              | `DENY`                                                                                                                                                                                       | Anti-framing for browsers that ignore `frame-ancestors`.                                                                                                                                                |
| `X-Robots-Tag`                 | `noindex, nofollow` for **admin and shop** only                                                                                                                                              | Keeps the private consoles out of search engines. This is decided by the app the image was built for, and no environment variable can switch it off. Web and TV do not send the header.                 |
| `Cache-Control`                | `/assets/*`: `public, max-age=31536000, immutable`; `index.html` and SPA routes: `no-cache`; `favicon.svg`, `site.webmanifest`, `robots.txt`: `public, max-age=3600`; `/healthz`: `no-store` | Hashed assets never change. The HTML is revalidated on every load, so a deploy takes effect straight away.                                                                                              |

nginx also sends `server_tokens off` (no version), answers only `GET`/`HEAD` (other methods get 405), returns 404 for
dotfiles, and logs the path without the query string or referrer.

## Content-Security-Policy

Template (one line when served):

```
default-src 'none';
script-src 'self' <inline script hashes>;
style-src 'self' <inline <style> hashes>;
style-src-attr 'unsafe-hashes' <style="" hashes> | 'none';
img-src 'self' $BETNG_IMG_ORIGINS;
font-src 'self';
connect-src 'self' $BETNG_API_ORIGIN $BETNG_WS_ORIGIN $BETNG_UPLOAD_ORIGINS $BETNG_ANALYTICS_ORIGIN;
manifest-src 'self';
object-src 'none';
base-uri 'none';
form-action 'self' $BETNG_CHECKOUT_ORIGINS;
frame-ancestors 'none';
upgrade-insecure-requests
```

- **No `'unsafe-inline'` and no `'unsafe-eval'` anywhere.** The web, shop and admin index.html each have a small inline theme script, and web
  also has an inline boot `<style>`. Both are allowed by their SHA-256 hash, computed from the built `dist/index.html`
  during the image build, so the hash always matches the file being served.
- **Styles:** React applies `style={…}` props through the CSSOM (`element.style`), and CSP does not govern that path.
  So `'unsafe-inline'` is not needed in `style-src`. The only `style="…"` attributes the HTML parser sees are the boot
  placeholders in the tv and admin index.html. Those are allowed through `style-src-attr 'unsafe-hashes'` plus the
  exact attribute hash. Web and shop send `style-src-attr 'none'`.
- **Fonts:** Inter and Archivo are self-hosted variable fonts under `/assets`, so `font-src 'self'`.
- **Images:** crests and icons are inline SVG. `img-src` accepts extra origins only for platform-supplied crest
  `assetUrl`s (`BETNG_IMG_ORIGINS`). If an image is blocked, the component falls back to the SVG crest.
- **Connections:** the gateway (`VITE_API_URL`) and the realtime endpoint (`VITE_WS_URL`), plus the KYC upload hosts.
- **form-action** adds the payment providers' hosted-checkout origins.
- **Framing:** `frame-ancestors 'none'` for all four apps, so none of them can be framed.
- `upgrade-insecure-requests` is left out only when `BETNG_ALLOW_INSECURE_ORIGINS=true`, which is for local compose.

### Runtime variables (container)

| Variable                       | Required | Accepts                                                                   |
| ------------------------------ | -------- | ------------------------------------------------------------------------- |
| `BETNG_API_ORIGIN`             | yes      | `https://host[:port]`                                                     |
| `BETNG_WS_ORIGIN`              | yes      | `wss://` or `https://` (SSE) origin                                       |
| `BETNG_UPLOAD_ORIGINS`         | no       | comma/space separated `https://` origins, `https://*.example.com` allowed |
| `BETNG_ANALYTICS_ORIGIN`       | no       | the `https://` origin of the analytics collector (`VITE_ANALYTICS_HOST`); omit when analytics is off |
| `BETNG_CHECKOUT_ORIGINS`       | no       | same format                                                               |
| `BETNG_IMG_ORIGINS`            | no       | same format                                                               |
| `BETNG_ALLOW_INSECURE_ORIGINS` | no       | `false` (default) or `true` to accept `http:`/`ws:` for local use         |

The entrypoint refuses to start if an origin is not a bare `scheme://host[:port]` (no path, quote, `;` or `$`), if its
scheme is not allowed, or if a required value is missing. A bad value cannot inject CSP directives or nginx variables.
Origins must match what was baked into the bundle: `BETNG_API_ORIGIN` is the origin of `VITE_API_URL`, and
`BETNG_WS_ORIGIN` is the origin of `VITE_WS_URL`. `VITE_UPLOAD_HOSTS=.uploads.example.com` corresponds to
`BETNG_UPLOAD_ORIGINS=https://*.uploads.example.com`.

## Verify

```sh
curl -sSI https://<host>/                       # all headers on the HTML
curl -sSI https://<host>/assets/<file>.js | grep -i cache-control   # immutable
curl -sSI https://<host>/does/not/exist         # SPA fallback: 200, no-cache
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://<host>/   # 405
curl -sSI https://admin.<host>/ | grep -i x-robots-tag              # noindex, nofollow
```

In a browser, the DevTools console reports a CSP violation as "Refused to …" or "violates the following Content
Security Policy directive". CI (`containers.yml`) boots each image read-only and fails if a core header is missing.
