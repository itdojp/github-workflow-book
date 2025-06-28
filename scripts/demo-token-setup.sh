#!/bin/bash
# 
# Deployment Token Setup Demo Script
# Demonstrates the new simplified token setup process
#

echo "🚀 Book Publishing Template - Deployment Token Setup Demo"
echo ""

echo "📋 Available Commands:"
echo ""

echo "1. Token Validation:"
echo "   npm run validate-token                    # Check existing token"
echo "   GITHUB_TOKEN=<token> npm run validate-token"
echo ""

echo "2. Interactive Setup Wizard:"
echo "   npm run setup-token                       # Full guided setup"
echo ""

echo "3. Traditional Methods (still available):"
echo "   Manual setup via deployment-guide.md"
echo "   Environment variables"
echo ""

echo "🔍 Testing Token Validation (with invalid token)..."
echo ""

# Demonstrate validation with invalid token
GITHUB_TOKEN="invalid_token_demo" timeout 10 npm run validate-token 2>/dev/null || true

echo ""
echo "✅ Demo completed!"
echo ""
echo "💡 Next Steps:"
echo "   1. Run 'npm run setup-token' for full interactive setup"
echo "   2. Check docs/token-setup-guide.md for detailed instructions"
echo "   3. Use 'npm run validate-token' anytime to check token status"