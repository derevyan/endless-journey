#!/bin/bash

# TypeScript Code Statistics Script
# Calculates effective TypeScript code lines in the project

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  TypeScript Code Statistics${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check if cloc is installed
if ! command -v cloc &> /dev/null; then
    echo -e "${YELLOW}Error: cloc is not installed.${NC}"
    echo "Install it with: brew install cloc"
    exit 1
fi

# Directories to exclude
EXCLUDE_DIRS="node_modules,dist,build,.next,coverage,.turbo"

echo -e "${GREEN}📊 Overall Statistics${NC}"
echo "─────────────────────────────────────────────────────────"
cloc --include-lang=TypeScript \
     --exclude-dir="$EXCLUDE_DIRS" \
     --quiet \
     .

echo ""
echo -e "${GREEN}📁 Breakdown by Directory${NC}"
echo "─────────────────────────────────────────────────────────"

# Apps directory
if [ -d "apps" ]; then
    echo ""
    echo -e "${BLUE}apps/${NC}"
    cloc --include-lang=TypeScript \
         --exclude-dir="$EXCLUDE_DIRS" \
         --quiet \
         apps/ 2>/dev/null | grep -E "(TypeScript|SUM)" | tail -2
fi

# Packages directory
if [ -d "packages" ]; then
    echo ""
    echo -e "${BLUE}packages/${NC}"
    cloc --include-lang=TypeScript \
         --exclude-dir="$EXCLUDE_DIRS" \
         --quiet \
         packages/ 2>/dev/null | grep -E "(TypeScript|SUM)" | tail -2
fi

# Individual package breakdown
if [ -d "packages" ]; then
    echo ""
    echo -e "${GREEN}📦 Individual Packages${NC}"
    echo "─────────────────────────────────────────────────────────"
    for pkg in packages/*/; do
        if [ -d "$pkg" ]; then
            pkg_name=$(basename "$pkg")
            echo ""
            echo -e "${BLUE}packages/$pkg_name/${NC}"
            cloc --include-lang=TypeScript \
                 --exclude-dir="$EXCLUDE_DIRS" \
                 --quiet \
                 "$pkg" 2>/dev/null | grep -E "(TypeScript|SUM)" | tail -2
        fi
    done
fi

# Individual app breakdown
if [ -d "apps" ]; then
    echo ""
    echo -e "${GREEN}🖥️  Individual Apps${NC}"
    echo "─────────────────────────────────────────────────────────"
    for app in apps/*/; do
        if [ -d "$app" ]; then
            app_name=$(basename "$app")
            echo ""
            echo -e "${BLUE}apps/$app_name/${NC}"
            cloc --include-lang=TypeScript \
                 --exclude-dir="$EXCLUDE_DIRS" \
                 --quiet \
                 "$app" 2>/dev/null | grep -E "(TypeScript|SUM)" | tail -2
        fi
    done
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

