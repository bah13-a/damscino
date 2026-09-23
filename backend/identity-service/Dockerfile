# Build context: the backend/ directory (docker build -f identity-service/Dockerfile backend/)
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
COPY common/pom.xml common/
COPY gateway/pom.xml gateway/
COPY identity-service/pom.xml identity-service/
COPY partner-service/pom.xml partner-service/
COPY privilege-service/pom.xml privilege-service/
COPY reporting-service/pom.xml reporting-service/
RUN mvn -q -B -pl identity-service -am dependency:go-offline -DskipTests || true
COPY . .
RUN mvn -q -B -pl identity-service -am package -DskipTests

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /src/identity-service/target/identity-service.jar app.jar
USER app
# Sized for small instances (512 MB, e.g. Render free / starter)
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1"
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
