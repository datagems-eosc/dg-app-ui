#!/bin/bash

# Build script for DataGEMS Frontend with base path support

# Default values
BASE_PATH=${NEXT_PUBLIC_BASE_PATH:-"/myapp"}
IMAGE_NAME="data-gems-frontend"
CONTAINER_NAME="data-gems-frontend"

echo "Building DataGEMS Frontend with base path: $BASE_PATH"

# Build the Docker image with build argument
echo "Building Docker image..."
docker build --build-arg NEXT_PUBLIC_BASE_PATH=$BASE_PATH -t $IMAGE_NAME .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
    
    # Stop and remove existing container if it exists
    echo "Stopping existing container..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    
    # Run the container
    echo "Starting container with base path: $BASE_PATH"
    docker run -d \
        --name $CONTAINER_NAME \
        -p 3000:3000 \
        -e NODE_ENV=production \
        -e NEXT_TELEMETRY_DISABLED=1 \
        --restart unless-stopped \
        $IMAGE_NAME
    
    if [ $? -eq 0 ]; then
        echo "✅ Container started successfully!"
        echo "🌐 Application available at: http://localhost:3000$BASE_PATH"
        echo "📊 Container logs: docker logs $CONTAINER_NAME"
        echo "🛑 Stop container: docker stop $CONTAINER_NAME"
    else
        echo "❌ Failed to start container"
        exit 1
    fi
else
    echo "❌ Failed to build Docker image"
    exit 1
fi 