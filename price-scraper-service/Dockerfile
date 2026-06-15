# Puppeteer icin: kendi Chromium'unu indirme, sistem chromium'unu kullan (daha hafif)
FROM node:20-bookworm-slim

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Chromium + gerekli yazi tipleri
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
EXPOSE 4000

CMD ["node", "server.js"]
