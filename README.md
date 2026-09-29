# cron-lateness

Measure how late (or absent) a scheduled job really is, and a Kestra flow that reports its own lateness.

Companion code for the article *My "every five minutes" cron ran every three hours*.

## Files

- `.github/workflows/heartbeat.yml` — a GitHub Actions workflow on `*/5 * * * *` that appends one JSON line per run (`{"scheduled": ..., "started": ...}`) to `heartbeat.jsonl`. Drop it into any repository to record what the `schedule` event actually does.
- `lateness.mjs` — reads `heartbeat.jsonl` and prints median / p90 / max lateness, the longest gap between runs, and the number of five-minute slots that got no run at all.
- `flow.yaml` — a Kestra flow with a `Schedule` trigger and a Node script task that calls a refresh endpoint and publishes `lateness_s` as an output. Validated against `kestra/kestra:latest` on 2026-09-29.

## Measure your own schedule

```bash
# after a day of heartbeats
node lateness.mjs heartbeat.jsonl
```

Example output for a day that produced six runs where 288 were due:

```
runs            6
span            19.3h (232 expected slots of 300s)
lateness median 1.0m
lateness p90    3.0m
lateness max    4.0m
longest gap     4.9h between consecutive runs
missed slots    226 (97.4% of expected)
```

Note that the heartbeat snaps each start to the previous five-minute boundary, so reported lateness is capped at five minutes. The number to watch is `missed slots`.

## Run the Kestra flow locally

```bash
docker run -d --name kestra -p 8080:8080 --user=root \
  -v /var/run/docker.sock:/var/run/docker.sock -v /tmp:/tmp \
  -e SECRET_APP_TOKEN="$(printf your-token | base64)" \
  -e KESTRA_CONFIGURATION="$(printf 'kestra:\n  server:\n    basic-auth:\n      username: you@example.com\n      password: ChangeMe1234\n')" \
  kestra/kestra:latest server local

curl -u you@example.com:ChangeMe1234 -X POST http://localhost:8080/api/v1/main/flows/validate \
  -H 'Content-Type: application/x-yaml' --data-binary @flow.yaml
curl -u you@example.com:ChangeMe1234 -X POST http://localhost:8080/api/v1/main/flows \
  -H 'Content-Type: application/x-yaml' --data-binary @flow.yaml
```

Replace `REFRESH_URL` in `flow.yaml` with your own endpoint. It must be idempotent.

## License

MIT
