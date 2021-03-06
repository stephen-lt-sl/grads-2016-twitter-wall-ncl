FROM microsoft/dotnet:latest

RUN ["mkdir", "/tmp/app"]
COPY TwitterWall/src/TwitterWall /tmp/app
WORKDIR /tmp/app

RUN apt-get -qq update && apt-get -qqy --no-install-recommends install \
    git \
    unzip libssl1.0.0

# Trigger the population of the local package cache
ENV NUGET_XMLDOC_MODE skip
RUN mkdir warmup \
    && cd warmup \
    && dotnet new \
    && cd .. \
    && rm -rf warmup

RUN curl -sL https://deb.nodesource.com/setup_6.x |  bash -
RUN apt-get install -y nodejs

RUN npm install --production
RUN npm run setup

RUN ["dotnet", "restore"]
RUN ["dotnet", "publish", "-o", "/app"]

WORKDIR /app

EXPOSE 5000/tcp
ENV ASPNETCORE_URLS http://*:5000

CMD dotnet /app/app.dll
