#!/bin/bash

# Development setup script for Obsidian Repeat Plugin

echo "Setting up development environment..."

# Create symlinks for development
PLUGIN_DIR="test-vault/.obsidian/plugins/repeat-plugin"

# Remove existing files and create symlinks
rm -f "$PLUGIN_DIR/main.js" "$PLUGIN_DIR/manifest.json" "$PLUGIN_DIR/styles.css"
ln -sf "$(pwd)/main.js" "$PLUGIN_DIR/main.js"
ln -sf "$(pwd)/manifest.json" "$PLUGIN_DIR/manifest.json" 
ln -sf "$(pwd)/styles.css" "$PLUGIN_DIR/styles.css"

echo "Development environment ready!"
echo "1. Open Obsidian and add the test-vault folder as a vault"
echo "2. Enable the Repeat plugin in Settings > Community plugins"
echo "3. Run 'yarn dev' to start development mode with auto-rebuild"
