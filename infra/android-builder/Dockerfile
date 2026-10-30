# Android build environment for infra/build-apk.sh: JDK 17, Node 22 and the Android command-line tools. The SDK
# components the project needs (platform, build-tools, NDK, CMake) are downloaded by Gradle on the first build and
# kept in the damascino-android-sdk volume.
FROM node:22-bookworm-slim AS node

FROM eclipse-temurin:17-jdk-jammy
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

ENV ANDROID_HOME=/opt/android-sdk ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=$PATH:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends curl unzip git >/dev/null \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p "$ANDROID_HOME/cmdline-tools" \
 && curl -fsSL --retry 3 -o /tmp/tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
 && unzip -q /tmp/tools.zip -d "$ANDROID_HOME/cmdline-tools" \
 && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" \
 && rm /tmp/tools.zip \
 && (yes | sdkmanager --licenses >/dev/null) \
 && sdkmanager --install "platform-tools" >/dev/null

WORKDIR /app
