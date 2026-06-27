#!/bin/bash

echo "🧪 Running Acceptance Tests for env:check"
echo ""

# Setup
BACKUP_FILE=".env.local.backup"
[ -f .env.local ] && cp .env.local $BACKUP_FILE

PASS_COUNT=0
FAIL_COUNT=0

# Test 1: Valid env
echo "Test 1: Valid environment variables"
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test
SUPABASE_URL=https://test.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service
EOF

if npm run env:check > /dev/null 2>&1; then
  echo "✅ PASS: Valid env detected"
  ((PASS_COUNT++))
else
  echo "❌ FAIL: Valid env should pass"
  ((FAIL_COUNT++))
fi
echo ""

# Test 2: Missing vars
echo "Test 2: Missing environment variables"
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
EOF

if npm run env:check > /dev/null 2>&1; then
  echo "❌ FAIL: Missing vars should fail"
  ((FAIL_COUNT++))
else
  echo "✅ PASS: Missing vars detected"
  ((PASS_COUNT++))
fi
echo ""

# Test 3: No file
echo "Test 3: No .env.local file"
rm -f .env.local

if npm run env:check > /dev/null 2>&1; then
  echo "❌ FAIL: No file should fail"
  ((FAIL_COUNT++))
else
  echo "✅ PASS: No file detected"
  ((PASS_COUNT++))
fi
echo ""

# Test 4: Invalid URL format
echo "Test 4: Invalid URL format"
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=not-a-valid-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test
SUPABASE_URL=not-a-valid-url
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service
EOF

if npm run env:check > /dev/null 2>&1; then
  echo "❌ FAIL: Invalid URL should fail"
  ((FAIL_COUNT++))
else
  echo "✅ PASS: Invalid URL detected"
  ((PASS_COUNT++))
fi
echo ""

# Cleanup
[ -f $BACKUP_FILE ] && mv $BACKUP_FILE .env.local || rm -f .env.local

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Acceptance tests complete!"
echo "   Passed: $PASS_COUNT"
echo "   Failed: $FAIL_COUNT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAIL_COUNT -eq 0 ]; then
  exit 0
else
  exit 1
fi
