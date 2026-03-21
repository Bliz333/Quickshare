ARG APP_BASE_IMAGE=quickshare:local
FROM ${APP_BASE_IMAGE}

WORKDIR /app

COPY target/*.jar /app/app.jar
