# Backend Dockerfile — Express + MongoDB + Puppeteer (fiyat tarama)
# Render / Fly.io / Railway gibi Docker destekleyen platformlarda calisir.
FROM node:20-bookworm-slim

# Puppeteer icin: kendi Chromium'unu indirme, sistem chromium'unu kullan (daha hafif)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Chromium + gerekli yazi tipleri (apt chromium gerekli kutuphaneleri kendi getirir)
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Once bagimliliklar (katman cache icin)
COPY package*.json ./
RUN npm ci --omit=dev

# Uygulama kodu
COPY . .

ENV NODE_ENV=production
# Render/Fly PORT'u kendisi enjekte eder; kod process.env.PORT okur.
EXPOSE 3000

CMD ["node", "src/server.js"]
