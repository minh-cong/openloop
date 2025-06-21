#!/bin/bash

# OpenLoop Research Assistant - Production Deployment Script

set -e

echo "🚀 Starting OpenLoop Research Assistant deployment..."

# Check if .env file exists OR environment variables are set
if [ -f "backend/.env" ]; then
    echo "📄 Using backend/.env file for configuration"
    # Load environment variables for Docker Compose
    export $(cat backend/.env | xargs)
elif [ ! -z "$OPENAI_API_KEY" ]; then
    echo "🌍 Using system environment variables for configuration"
    echo "OPENAI_API_KEY is set: ${OPENAI_API_KEY:0:10}..."
    if [ ! -z "$TAVILY_API_KEY" ]; then
        echo "TAVILY_API_KEY is set: ${TAVILY_API_KEY:0:10}..."
    else
        echo "❌ Error: TAVILY_API_KEY is required for web search functionality"
        exit 1
    fi
else
    echo "❌ Error: No configuration found!"
    echo "Either create backend/.env file OR set environment variables:"
    echo "export OPENAI_API_KEY=your_openai_api_key"
    echo "export TAVILY_API_KEY=your_tavily_api_key"
    exit 1
fi

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed!"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed!"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Load environment variables for Docker Compose if .env exists
if [ -f "backend/.env" ]; then
    export $(cat backend/.env | xargs)
fi

echo "🔧 Building and starting containers..."
docker-compose up --build -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Health check
echo "🏥 Checking service health..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ OpenLoop Research Assistant is running!"
    echo "🌐 Access the application at: http://localhost:3000"
    echo "📚 API documentation at: http://localhost:3000/docs"
else
    echo "❌ Health check failed. Checking logs..."
    docker-compose logs openloop-research
fi

echo "📝 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"
