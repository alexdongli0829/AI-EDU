#!/bin/bash

set -x
git ls-tree -r --name-only HEAD | while read -r f; do
  aws s3 cp "$f" "s3://dongaws-ai/AI-EDU/$f"
done
