#!/bin/bash

# Clean dist directory
rm -rf dist

# Generate version file from package.json
bun run generate-version

# Build with TypeScript
bunx tsc --project tsconfig.build.json

# Check if build was successful
if [ ! -f "dist/cli.js" ]; then
    echo "❌ Build failed: dist/cli.js not found"
    exit 1
fi

# Add shebang to cli.js (only if not already present)
if ! head -n 1 dist/cli.js | grep -q "#!/usr/bin/env bun"; then
    sed -i.bak '1i\
#!/usr/bin/env bun
' dist/cli.js && rm dist/cli.js.bak
fi

# Make executable
chmod +x dist/cli.js

echo "✅ Build completed successfully!"
