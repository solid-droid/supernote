# Setup script for Super Note dependencies (Windows)

function Install-If-Missing($name, $checkCommand, $installCommand) {
    Write-Host "Checking for $name..." -ForegroundColor Cyan
    try {
        Invoke-Expression "$checkCommand" | Out-Null
        Write-Host "$name is already installed." -ForegroundColor Green
    } catch {
        Write-Host "$name not found. Installing..." -ForegroundColor Yellow
        Invoke-Expression "$installCommand"
    }
}

# 1. Rust
Install-If-Missing "Rust" "rustc --version" 'winget install --id Rustlang.Rustup -e --accept-package-agreements --accept-source-agreements'

# 2. Bun
Install-If-Missing "Bun" "bun --version" 'powershell -c "irm bun.sh/install.ps1 | iex"'

# 3. Python
Install-If-Missing "Python" "python --version" 'winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements'

# 4. PyInstaller (Python package)
Write-Host "Checking for PyInstaller..." -ForegroundColor Cyan
& python -m pip install pyinstaller

# 5. Node dependencies
Write-Host "Installing project dependencies..." -ForegroundColor Cyan
npm install

Write-Host "`nSetup complete! You may need to restart your terminal for changes to take effect." -ForegroundColor Green
