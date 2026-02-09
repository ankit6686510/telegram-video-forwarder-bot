#!/bin/bash

# Prevent Mac from sleeping while running the script
# -i : Prevent idle sleep
# -s : Prevent system sleep
# -m : Prevent disk idle sleep
# -d : Prevent display sleep (optional, included to be safe)

echo "🚀 Starting Telegram Forwarder with Keep-Alive..."
echo "☕️ Your Mac will NOT sleep while this script is running."
echo "Press Ctrl+C to stop."

# Run with increased concurrency (from .env or default)
# Run with safe concurrency (matches .env)
export CONCURRENT_DOWNLOADS=3

caffeinate -i -s -m -d npx ts-node src/forward-history.ts
