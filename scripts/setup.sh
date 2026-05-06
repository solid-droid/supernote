#!/bin/bash

# Setup script for Super Note dependencies (Unix/macOS)

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "Checking dependencies..."

# 1. Rust
if command_exists rustc; then
    echo "Rust is already installed."
else
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# 2. Bun
if command_exists bun; then
    echo "Bun is already installed."
else
    echo "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
fi

# 3. Python
if command_exists python3; then
    echo "Python is already installed."
else
    echo "Please install Python 3 using your package manager (e.g., brew install python, apt install python3)."
fi

# 4. PyInstaller
if command_exists pyinstaller; then
    echo "PyInstaller is already installed."
else
    echo "Installing PyInstaller..."
    pip3 install pyinstaller
fi

# 5. Node dependencies
echo "Installing project dependencies..."
npm install

echo "Setup complete!"
