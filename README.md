# Chatwerk

Chatwerk is a shared music room. Several users share one room, hear the same song and chat with an AI band. Only the band changes the song. The song is [Strudel](https://strudel.cc) code. The design is in [docs/design.md](docs/design.md).

## Status

- Phase 0 (model bake-off): done. The band is Claude Haiku 5.5 with thinking off and system prompt v3.
- Phase 1 (local demo): done. Room server, WebSocket, agent queue with batching, versions in SQLite, the player with the hap gate and the limiter, layer cards and the code view.
- Phase 2 (feel): done. Room clock sync, transitions on the next bar or phrase, reactions, local mute and solo, "Open in strudel.cc".
- Phase 3 (hosting): live at https://chatwerk.woutkonings.com on `vps-main`. See [docs/deploy.md](docs/deploy.md).

## Run it

1. Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`.
2. `npm install`
3. `npm run build`, then `npm start`.
4. Open http://localhost:8787, start a room and share the link.

For development, `npm run dev` starts the server on port 8787 (it restarts on changes) and Vite on port 5173. Open http://localhost:5173.

To test with several users on one computer, open the room on `localhost` and on `127.0.0.1`: each origin has its own name and client id.

Other devices on the LAN can join at `http://<your-ip>:8787`. On plain http, browsers do not allow AudioWorklets, so some effects (shape, crush, coarse, distort) are silent there. Hosting with HTTPS fixes this.

## Settings (environment)

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | (none) | The key for the band. Without it, the band answers that it has no key. |
| `PORT` | `8787` | The HTTP and WebSocket port. |
| `HOST` | `0.0.0.0` | The listen address. |
| `DATA_DIR` | `data` | The folder of the SQLite file. |
| `MUSIC_CHAT_MODEL` | `haiku` | A setup from `server/llm.ts`, for example `sonnet`. |
| `MUSIC_CHAT_DAILY_USD` | `1` | The model budget per UTC day for all rooms. After that, the band does not answer until the next day. |

## Commands

- `npm test`: runs the tests (validator, interpreter, song operations, song checks, room actor, hap gate).
- `npm run typecheck`: checks the TypeScript types of the server and the web app.
- `npm run allowlist:check`: checks that every allowlisted Strudel name exists in the installed Strudel version.
- `npm run bakeoff`: runs a 10-turn chat session against each model setup and writes a report to `docs/bakeoff/`. To run only some setups: `npm run bakeoff -- haiku sonnet`.

## License

AGPL-3.0-or-later, because the app uses Strudel. Strudel is copyright its contributors, see [codeberg.org/uzu/strudel](https://codeberg.org/uzu/strudel).
