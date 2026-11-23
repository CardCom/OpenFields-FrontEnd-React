# OpenFieldsTester

A merchant checkout that uses CardCom **OpenFields** end to end - React + Vite page hosting the
CardCom iframes (card number, CVV, Apple Pay, Google Pay, Bit) and a Fastify backend that creates
the LowProfile, verifies with GetLpResult and handles the webhook. Use it to try OpenFields, by hand
or with the Playwright e2e specs, and as a reference for your own integration.

## Before you start: get a test company

**Contact CardCom support and request a test company with a test terminal.** Use it to try this
project and to build and test your own integration, before you connect a real terminal. You get a test
terminal number and an API user (`API_NAME` / `API_PASSWORD`) - put them in your `.env.<name>`.

Never experiment on a live terminal: every approved payment is a real charge.

> Demo backend: in-memory orders, no auth. Not a production integration - see the integration
> guide: [docs/cardcom-openfields-ecommerce-integration.md](docs/cardcom-openfields-ecommerce-integration.md).

**Integrating with an AI coding agent?** Point it at this repository. [AGENTS.md](AGENTS.md) (also loaded
by Claude Code through [CLAUDE.md](CLAUDE.md)) tells the agent to follow the integration guide, lists
the rules it must not break, and maps every part of the guide to the code here.

## One file per environment

Everything environment-specific lives in **one file at the root**: `.env.<name>` (copy
[`.env.example`](.env.example)). The host is written once; the app builds `<host>/api/v11` and
`<host>/api/OpenFields` from it. The files hold API credentials and are git-ignored.

| File | CardCom host | Terminal |
|---|---|---|
| `.env.prod` | `https://secure.cardcom.solutions` | your **test** terminal (see [Before you start](#before-you-start-get-a-test-company)) |

Add a file per environment you test against (`.env.<name>`, same keys, its own host and terminal).
To make one of them your default for `npm run dev` / `npm test`, put its name in a `.cardcom-env` file at the root
(git-ignored), e.g. `echo test > .cardcom-env`.

Optional keys: `AMOUNT` (default 1 ILS - every approved payment is a real charge), `SERVER_PORT`,
`WEB_PORT`, `PUBLIC_BASE_URL` (webhook target; default `https://example.com` because CardCom
rejects internal webhook addresses with 5170), `TEST_CARD_*` (card for the e2e specs).

## Run it

Node >= 22.15 (uses `--use-system-ca`, so hosts signed by a company CA are trusted too).

```bash
npm install
npm run dev                  # .env.prod (or CARDCOM_ENV); same as dev:prod
npm run dev -- --env=<name>  # any other .env.<name>
```

Open `https://localhost:5173` (self-signed certificate - accept it once). The header badge shows the
environment, host and terminal the page charges.

The page calls its own origin (`/api/...`); Vite proxies to the backend. Calling the backend's
http address from the https page directly would be mixed content, which every iPhone browser blocks.

## Languages

Every LowProfile language: Hebrew (default), English, Arabic, Russian, Spanish, German, French -
`?lang=he|en|ar|ru|es|de|fr` or the picker in the header (unknown values: the browser's language
when supported, else Hebrew). The page is right-to-left for Hebrew and Arabic.

The same code goes to LowProfile/Create (`Language` - CardCom's 3DS page, decline messages and
Description follow it), to every OpenFields iframe URL (`?language=` - the iframe's `<html lang>`,
`<title>` and the input's `aria-label`, for screen readers) and to the master frame's `init`.
Card number, expiry and CVV are numeric and stay left-to-right in every language.

Texts of this page: `apps/web/src/i18n/messages.ts`; languages: `apps/web/src/i18n/languages.ts`.

## End-to-end specs

```bash
npm test                     # .env.prod: Desktop Chrome + iPhone (WebKit) + Android (Pixel 7)
npm test -- --env=<name>     # any other .env.<name>
npm test -- --project="iPhone (WebKit)"
npm run report
```

The specs start the dev servers themselves (or reuse running ones). They check the environment
badge, that the iframes load from the configured host, every language (page `lang`/`dir`, texts,
the deal's language, the iframes' `lang`, `title` and `aria-label`), and pay - in English and
Hebrew - with the `TEST_CARD_*` card;
the backend's GetLpResult must agree with the page. **Every paid order is refunded in `afterEach`**,
also when an assertion failed; a failed refund fails the run with the transaction id.

In dev, React StrictMode mounts the checkout twice, so one page load creates two LowProfiles; only
one is attached to the iframes, the other stays unpaid.

## Layout

```
.env.example       template for .env.<name>
scripts/env.mjs    the only reader of .env.<name>
scripts/dev.mjs    starts server + web for one environment
scripts/test.mjs   runs the e2e specs for one environment
apps/web/          React + Vite + Tailwind checkout
server/            Fastify backend (LowProfile/Create, verify, webhook)
e2e/               Playwright specs
docs/              integration guide (+ LowProfile, webhook, void companions) for developers and AI agents
AGENTS.md          instructions for AI coding agents (CLAUDE.md imports it)
```
