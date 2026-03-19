FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /build

COPY pom.xml ./
RUN mvn -q -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -q -Dmaven.test.skip=true package

FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

ENV SPRING_PROFILES_ACTIVE=prod \
    SERVER_PORT=8080 \
    FILE_UPLOAD_DIR=/opt/quickshare/uploads \
    OFFICE_PREVIEW_COMMAND=soffice \
    OFFICE_PREVIEW_CACHE_DIR=/opt/quickshare/uploads/.preview-cache \
    RECAPTCHA_ENABLED=false \
    TZ=Asia/Shanghai \
    JAVA_OPTS=""

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        libreoffice-core \
        libreoffice-writer \
        libreoffice-calc \
        libreoffice-impress \
        fonts-noto-cjk \
        fonts-dejavu-core \
        fontconfig \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /opt/quickshare/uploads /opt/quickshare/uploads/.preview-cache /opt/quickshare/logs

COPY --from=build /build/target/*.jar /app/app.jar

EXPOSE 8080
VOLUME ["/opt/quickshare/uploads"]

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
