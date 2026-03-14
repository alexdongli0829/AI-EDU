#!/bin/bash
# Upload AI-EDU project to S3 with only necessary files
# Excludes: dependencies, build artifacts, caches, IDE files

# Configuration
S3_BUCKET="${1:-your-bucket-name}"
PROJECT_NAME="AI-EDU"

# Check if bucket name is provided
if [ "$S3_BUCKET" = "your-bucket-name" ]; then
    echo "Usage: ./upload-to-s3.sh <s3-bucket-name>"
    echo "Example: ./upload-to-s3.sh my-project-backup"
    exit 1
fi

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Uploading $PROJECT_NAME to s3://$S3_BUCKET/${PROJECT_NAME}/${NC}"
echo ""

# Create exclusion file
cat > /tmp/s3-exclude.txt <<EOF
# Dependencies
node_modules/*
venv/*
.venv/*
__pycache__/*
*.pyc
*.pyo
*.egg-info/*
.Python

# Build artifacts
cdk.out/*
dist/*
build/*
*.egg
*.whl

# IDE and editors
.idea/*
.vscode/*
.DS_Store
*.swp
*.swo
*~

# Environment and secrets
.env
.env.*
*.pem
*.key
credentials

# Cache and temporary
.pytest_cache/*
.cache/*
*.log
.coverage
htmlcov/*
.nyc_output/*
coverage/*

# Git and Claude
.git/*
.claude/*

# Lock files (optional - uncomment if you want to exclude)
# package-lock.json
# yarn.lock
EOF

echo -e "${GREEN}Excluding the following patterns:${NC}"
cat /tmp/s3-exclude.txt | grep -v "^#" | grep -v "^$"
echo ""

# AWS S3 sync with exclusions
echo -e "${BLUE}Starting upload...${NC}"
aws s3 sync . "s3://$S3_BUCKET/$PROJECT_NAME/" \
    --exclude ".git/*" \
    --exclude ".claude/*" \
    --exclude ".idea/*" \
    --exclude ".vscode/*" \
    --exclude "node_modules/*" \
    --exclude "*/node_modules/*" \
    --exclude "venv/*" \
    --exclude "*/venv/*" \
    --exclude ".venv/*" \
    --exclude "*/.venv/*" \
    --exclude "cdk.out/*" \
    --exclude "__pycache__/*" \
    --exclude "*/__pycache__/*" \
    --exclude "*.pyc" \
    --exclude ".pytest_cache/*" \
    --exclude "*/.pytest_cache/*" \
    --exclude "dist/*" \
    --exclude "build/*" \
    --exclude ".env" \
    --exclude ".env.*" \
    --exclude "*.log" \
    --exclude ".DS_Store" \
    --delete --profile self

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Upload complete!${NC}"
    echo -e "Your project is available at: s3://$S3_BUCKET/$PROJECT_NAME/"
    echo ""
    echo "To download it later:"
    echo "  aws s3 sync s3://$S3_BUCKET/$PROJECT_NAME/ ./AI-EDU/"
else
    echo ""
    echo "Upload failed. Please check your AWS credentials and bucket name."
    exit 1
fi

# Clean up
rm /tmp/s3-exclude.txt
