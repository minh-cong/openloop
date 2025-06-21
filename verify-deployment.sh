#!/bin/bash

# OpenLoop Research Assistant - Deployment Verification Script

echo "🔍 Verifying OpenLoop Research Assistant deployment..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check service
check_service() {
    local url=$1
    local name=$2
    
    if curl -s -f "$url" > /dev/null; then
        echo -e "${GREEN}✅ $name is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $name is not responding${NC}"
        return 1
    fi
}

# Check container status
echo "📦 Checking Docker container..."
if docker ps | grep -q "openloop-research.*healthy"; then
    echo -e "${GREEN}✅ Container is running and healthy${NC}"
else
    echo -e "${RED}❌ Container is not running or unhealthy${NC}"
    echo "Run: docker-compose ps"
    exit 1
fi

echo ""
echo "🏥 Testing services..."

# Check health endpoint
check_service "http://localhost:3000/health" "Health endpoint"

# Check API documentation
check_service "http://localhost:3000/docs" "API Documentation"

# Check frontend
check_service "http://localhost:3000/app/" "Frontend application"

echo ""
echo "🧪 Testing API functionality..."

# Test research endpoint
response=$(curl -s -X POST http://localhost:3000/research \
    -H "Content-Type: application/json" \
    -d '{"query": "What is AI?", "max_research_loops": 1}' \
    --max-time 30)

if echo "$response" | jq -e '.answer' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Research API is working${NC}"
else
    echo -e "${RED}❌ Research API is not working properly${NC}"
    echo "Response: $response"
fi

echo ""
echo "🎉 Deployment verification complete!"
echo ""
echo "📋 Access your application:"
echo "   🌐 Main Application: http://localhost:3000/app/"
echo "   📚 API Documentation: http://localhost:3000/docs"
echo "   🏥 Health Check: http://localhost:3000/health"
echo ""
echo "📝 Useful commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop: docker-compose down"
echo "   Restart: docker-compose restart"
