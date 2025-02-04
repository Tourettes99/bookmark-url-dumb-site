#!/bin/bash

# Skip Python setup completely
export SKIP_PYTHON_SETUP=1

# Install only Node.js dependencies
npm install

# Build the React app
npm run build
