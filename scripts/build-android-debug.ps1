$ErrorActionPreference = "Stop"

$javaHome = "C:\Program Files\Microsoft\jdk-21.0.12.8-hotspot"
if (-not (Test-Path -LiteralPath "$javaHome\bin\java.exe")) {
  throw "Java 21 was not found at $javaHome. Install Microsoft OpenJDK 21 or update this script."
}

$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;$env:PATH"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

$appBuild = Resolve-Path -LiteralPath "$PSScriptRoot\..\android\app" | Join-Path -ChildPath "build"
if (Test-Path -LiteralPath $appBuild) {
  Remove-Item -LiteralPath $appBuild -Recurse -Force
}

& "$PSScriptRoot\..\android\gradlew.bat" -p "$PSScriptRoot\..\android" assembleDebug --no-daemon
