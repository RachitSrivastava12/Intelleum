# testing-streams

Tiny standalone webhook receiver for checking whether QuickNode Solana Streams is reaching your machine.

## Run

```bash
cd testing-streams
npm run dev
```

## Local webhook URL

Use ngrok or another tunnel against port `8090`.

Example final webhook path:

```text
https://your-ngrok-url.ngrok-free.app/webhooks/quicknode
```

## Routes

- `GET /health`
- `GET /webhooks/quicknode`
- `POST /webhooks/quicknode`

The POST route always returns `200` so webhook connection tests do not fail while debugging.
