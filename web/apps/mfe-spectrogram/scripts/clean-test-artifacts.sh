#!/bin/bash

# Clean test artifacts script
# This script removes test results, build artifacts, and temporary files

echo "🧹 Cleaning test artifacts..."

# Remove test results
rm -rf test-results/
rm -rf tests/test-results/
rm -rf tests/e2e/test-data/
rm -rf playwright-report/
rm -rf allure-results/
rm -rf allure-report/

# Remove coverage reports
rm -rf coverage/
rm -rf .nyc_output/
rm -f lcov.info
rm -f coverage.json

# Remove temporary files
find . -name "*.log" -delete
find . -name "*.tmp" -delete
find . -name "*.temp" -delete
find . -name ".DS_Store" -delete

# Remove test artifacts
find . -name "*.webm" -delete
find . -name "test-failed-*.png" -delete
find . -name "error-context.md" -delete
find . -name "trace.zip" -delete

echo "✅ Test artifacts cleaned!"
