#!/bin/bash

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the project directory
cd "$DIR"

# Start the server without auto-opening browser (reuse existing tab)
node server.js

# If you want to auto-open browser, use this instead:
# OPEN_BROWSER=true node server.js