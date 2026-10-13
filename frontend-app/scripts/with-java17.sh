#!/usr/bin/env bash
set -euo pipefail

if [[ ! -x /usr/libexec/java_home ]]; then
  echo "macOS java_home was not found. Install JDK 17, then retry." >&2
  exit 1
fi

if /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
  export JAVA_HOME
  JAVA_HOME="$(/usr/libexec/java_home -v 17)"
elif /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
  export JAVA_HOME
  JAVA_HOME="$(/usr/libexec/java_home -v 21)"
else
  echo "JDK 17 or 21 is required for Android builds. Current Java may be too new for Gradle." >&2
  echo "Install a compatible JDK, for example Temurin 17, then retry." >&2
  exit 1
fi

export PATH="$JAVA_HOME/bin:$PATH"
echo "Using Java: $(java -version 2>&1 | head -n 1)"
exec "$@"
