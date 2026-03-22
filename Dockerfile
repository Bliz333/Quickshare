FROM mcr.microsoft.com/openjdk/jdk:17-ubuntu AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline -DskipTests

COPY src src
RUN ./mvnw -B -q package -DskipTests

FROM mcr.microsoft.com/openjdk/jdk:17-ubuntu

ENV DEBIAN_FRONTEND=noninteractive \
    OFFICE_PREVIEW_COMMAND=soffice \
    OFFICE_PREVIEW_CACHE_DIR=/opt/quickshare/uploads/.preview-cache

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        fontconfig \
        fonts-dejavu-core \
        fonts-noto-cjk \
        libreoffice-calc \
        libreoffice-core \
        libreoffice-impress \
        libreoffice-writer \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /workspace/target/*.jar /app/app.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
