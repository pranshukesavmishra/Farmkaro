#!/usr/bin/env bash
# Stop the dev server, drop the local database, start it again and wait until
# it answers. The sample identities can each be claimed once, so any flow test
# that claims one needs a fresh database to be repeatable.
set -u
cd "$(dirname "$0")/.."
pkill -f "next-server" 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 4
rm -f data/farmkaro.db*
nohup npm run dev >/tmp/farmkaro-dev.log 2>&1 &
for _ in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ || true)
  [ "$code" = "200" ] && { echo "dev server up on :3000 with a fresh database"; exit 0; }
  sleep 3
done
echo "dev server did not come up; see /tmp/farmkaro-dev.log" >&2
exit 1
