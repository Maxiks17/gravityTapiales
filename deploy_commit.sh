#!/bin/bash

DEPLOY_FILE="deploy.txt"

# Check if there are any changes (staged or unstaged)
if git diff --quiet && git diff --cached --quiet; then
    # No changes, modify deploy.txt to create a change
    echo -n "." >> "$DEPLOY_FILE"
fi

# Add all changes and commit
git add -A
git -c user.name="olariz" -c user.email="olarizdev@gmail.com" commit -m "deploy"
