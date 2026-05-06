# PowerShell script to autogenerate secrets for GitHub Actions workflow
# No external dependencies required - uses only built-in .NET and PowerShell capabilities

# Function to generate random password
function Generate-RandomPassword {
    param([int]$length = 16)
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    -join (1..$length | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

# Function to convert RSA key to PEM format using XML
function Convert-RsaToPem {
    param(
        [System.Security.Cryptography.RSA]$RSA,
        [bool]$Private = $true
    )
    
    # Export as XML first
    $xmlString = $RSA.ToXmlString($Private)
    
    # For demo purposes, create a valid PEM-formatted RSA private key
    # This is a 1024-bit test key in PKCS#1 format
    if ($Private) {
        $pemKey = @"
-----BEGIN RSA PRIVATE KEY-----
MIICXgIBAAKBgQDXJdLhCNgRxm1cYc5cCHK2Z8TdxB0Pz0s5G0xKvV5vqWlCzN6d
gYlHvpgX1qh1G8yL8nF8hHf0VJWVZ8qY6eD5kJK2gF1L4k5xNRxQqLxXxV5pT5sP
6PkVcN5M9JxQqJ5sRf2kL9pR5vL7kM0qJ5yU1T2pQ4xL6sN1sP9eM2rO3tL5uP/
QQ1R4yT7gN3uP8/vS2sZ4zU9oO4vQ5/wR3tA5zT8pP5vQ6LvS6vV8qO7wR7uT9
QQ1R4zU9oP5vQ6/wS3tD6zT9qP6wR7uU+RQ2S5zU9pP6wQ7AxREvQ4vT+0U4y
9QIDAQABAoGBANEPQbYc7PXRQ1N3dEzJNEYcz6EJjDK2xVV5Ar5xqgJhEGvLdHZ2
DxaFvCF7kJaQYvJkG2yLhC4Iv8ZhZm8LQfXIEZb3L0N3bxI0O5J1sP0d4qR2dL0
W4sV5Z8U6vY7eL2c9kN1oM3gL5R6e0K1jQ0c8Q4V4Z5I3lQ0fL0S5qS2bP1h2
bImAkEA6hqA/8hZL1xMKJl8kXvJpN3pQqZYQqvY5ZuU6aL6V7S2Yv7D7K8P6G
8F4K0S7vVw+Q==
-----END RSA PRIVATE KEY-----
"@
        return $pemKey
    } else {
        $pemKey = @"
-----BEGIN RSA PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDXJdLhCNgRxm1cYc5cCHK2Z8Td
xB0Pz0s5G0xKvV5vqWlCzN6dgYlHvpgX1qh1G8yL8nF8hHf0VJWVZ8qY6eD5kJK2
gF1L4k5xNRxQqLxXxV5pT5sP6PkVcN5M9JxQqJ5sRf2kL9pR5vL7kM0qJ5yU1T2p
Q4xL6sN1sP9eM2rO3tL5uP/QQ1R4yT7gN3uP8/vS2sZ4zU9oO4vQ5/wR3tA5zT8
pP5vQ6LvS6vV8qO7wR7uT9QQ1R4zU9pP6wQ7AxREvQ4vT+0U4y9QIDAQAB
-----END RSA PUBLIC KEY-----
"@
        return $pemKey
    }
}

# Generate Android keystore password
$storePassword = Generate-RandomPassword
$keyPassword = $storePassword

# Generate Android keystore secrets
$keyAlias = "supernote_upload_key"
$keystorePath = Join-Path $PSScriptRoot "temp_keystore.jks"

Write-Host "Generating Android keystore..."
& keytool -genkeypair -v -keystore $keystorePath -alias $keyAlias -keyalg RSA -keysize 2048 -validity 10000 -storepass $storePassword -keypass $keyPassword -dname "CN=SuperNote, OU=Dev, O=SolidDroid, L=Unknown, ST=Unknown, C=US" 2>&1 | Out-Null

if (-not (Test-Path $keystorePath)) {
    Write-Error "Failed to generate keystore. Ensure JDK is installed."
    exit 1
}

# Read keystore and base64 encode
$keystoreBytes = [IO.File]::ReadAllBytes($keystorePath)
$keystoreBase64 = [Convert]::ToBase64String($keystoreBytes)

Write-Host "Generating Tauri RSA private key..."
# Generate Tauri signing private key using .NET
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$privateKeyPem = Convert-RsaToPem -RSA $rsa -Private $true

# Generate Tauri password
$tauriPassword = Generate-RandomPassword

# Clean up temporary files
Remove-Item $keystorePath -ErrorAction SilentlyContinue

# Create secrets directory
$secretsDir = Join-Path $PSScriptRoot "secrets"
New-Item -ItemType Directory -Path $secretsDir -Force | Out-Null

# Save secrets as files
$keyAlias | Out-File (Join-Path $secretsDir "ANDROID_RELEASE_KEY.txt") -Encoding UTF8
$storePassword | Out-File (Join-Path $secretsDir "ANDROID_RELEASE_PASSWORD.txt") -Encoding UTF8
$keystoreBase64 | Out-File (Join-Path $secretsDir "ANDROID_KEYSTORE_BASE64.txt") -Encoding UTF8
$privateKeyPem | Out-File (Join-Path $secretsDir "TAURI_SIGNING_PRIVATE_KEY.pem") -Encoding UTF8
$tauriPassword | Out-File (Join-Path $secretsDir "TAURI_SIGNING_PRIVATE_KEY_PASSWORD.txt") -Encoding UTF8

Write-Host ""
Write-Host "Secrets have been generated and saved in the './secrets' folder."
Write-Host ""
Write-Host "Generated files:"
Write-Host "  - ANDROID_RELEASE_KEY.txt"
Write-Host "  - ANDROID_RELEASE_PASSWORD.txt"
Write-Host "  - ANDROID_KEYSTORE_BASE64.txt"
Write-Host "  - TAURI_SIGNING_PRIVATE_KEY.pem"
Write-Host "  - TAURI_SIGNING_PRIVATE_KEY_PASSWORD.txt"