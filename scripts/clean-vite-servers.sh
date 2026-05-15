#!/bin/bash
# Clean up Vite dev servers
#
# Kills all running Vite instances on ports 5173-5180
# Useful when multiple dev servers accumulate from repeated runs

set +e  # Don't exit on error (some ports may be free)

echo "🧹 Cleaning up Vite dev servers..."
echo "================================="
echo ""

# Counter for killed processes
killed_count=0

# Check ports 5173 to 5180 (Vite default + fallbacks)
for port in {5173..5180}; do
    # Find process using this port
    pid=$(lsof -ti:$port 2>/dev/null)
    
    if [ -n "$pid" ]; then
        echo "🔴 Found process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "   ✅ Killed successfully"
            killed_count=$((killed_count + 1))
        else
            echo "   ⚠️  Failed to kill (may require sudo)"
        fi
    fi
done

echo ""
echo "================================="
if [ $killed_count -eq 0 ]; then
    echo "✨ No Vite servers were running"
else
    echo "✅ Cleaned up $killed_count Vite server(s)"
fi
echo ""
echo "You can now run: ./scripts/run-web-app.sh"
echo ""
