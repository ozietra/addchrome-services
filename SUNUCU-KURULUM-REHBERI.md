# Sunucu (Backend) Kurulum Rehberi — Ücretsiz Yayına Alma

Bu rehber, eklentilerin konuştuğu backend'i (giriş, abonelik, ödeme, fiyat tarama)
internete **ücretsiz** olarak nasıl koyacağınızı anlatır.

---

## Önce kısa cevaplar

**“localhost yerine domain mi yazmam gerekecek?”**
Evet. Eklentiler yayınlandığında başka insanların bilgisayarında çalışır; `localhost:3000`
sadece senin bilgisayarını gösterir. Bu yüzden backend'in internetten erişilebilen bir
adresi olmalı. Bu adres ya bir hosting platformunun verdiği ücretsiz URL olur
(ör. `https://chrome-extensions-backend.onrender.com`) ya da kendi alan adın
(ör. `https://api.siteniz.com`). Kendi alan adı **şart değil** — platformun verdiği
ücretsiz URL de gayet çalışır.

**“Node.js destekli sunucu mu olacak?”**
Evet. Backend gerçek bir Node.js uygulaması (Express + MongoDB + Puppeteer). Yani statik
hosting (Netlify/GitHub Pages gibi) yetmez; “web service / container” çalıştıran bir
platform gerekir. Aşağıdaki ücretsiz kurulum tam da bunu yapar.

**Ücretsiz mi olur?**
Evet, şu kombinasyonla 0₺:
- **Veritabanı:** MongoDB Atlas — ücretsiz M0 (512 MB)
- **Sunucu:** Render — ücretsiz web service (aylık 750 saat, kredi kartı istemez)

> Ücretsiz katmanın iki dikkat noktası: (1) 15 dakika istek gelmezse sunucu “uyur”, ilk
> istekte ~1 dakika gecikmeyle uyanır. (2) Fiyat tarama (Puppeteer/Chromium) belleğe açtır;
> ücretsiz 512 MB altında yoğun aramada zorlanabilir. Sorun yaşarsan en ucuz ücretli
> katmana (~7 USD/ay) geçmek bunu çözer.

---

## Adım 1 — MongoDB Atlas (veritabanı, ücretsiz)

1. https://www.mongodb.com/atlas adresine kaydol.
2. **Create** → **M0 (Free)** cluster oluştur (bölge olarak Frankfurt/Avrupa seç).
3. **Database Access** → yeni kullanıcı oluştur (kullanıcı adı + güçlü şifre). Şifreyi not al.
4. **Network Access** → **Add IP Address** → `0.0.0.0/0` (her yerden erişim) ekle.
   (Render'ın IP'si sabit olmadığı için ücretsiz katmanda bu en pratik yol.)
5. **Connect** → **Drivers** → bağlantı adresini kopyala. Şöyle görünür:
   ```
   mongodb+srv://KULLANICI:SIFRE@cluster0.xxxxx.mongodb.net/chrome-extensions?retryWrites=true&w=majority
   ```
   `KULLANICI` ve `SIFRE` kısmını kendi bilgilerinle değiştir. Sonundaki
   `/chrome-extensions` veritabanı adıdır, kalsın. Bu adres senin `MONGODB_URI` değerin.

---

## Adım 2 — Kodu GitHub'a koy

Render, kodu bir Git deposundan çeker.

1. https://github.com 'da yeni (private olabilir) bir repo aç.
2. Proje klasörünü pushla. **`backend/.env` ve `node_modules` gitmesin** — repo köküne
   bir `.gitignore` ekle:
   ```
   node_modules/
   **/node_modules/
   .env
   **/.env
   backend/debug/
   dist/
   ```
   (Hazır gelen `backend/.dockerignore` zaten imaj içine bunları almaz; `.gitignore` ise
   GitHub'a gitmesini engeller.)

---

## Adım 3 — Render'da yayına al (Blueprint ile, neredeyse tek tık)

Repo kökünde hazır bir **`render.yaml`** var; Render bunu okuyup servisi otomatik kurar.

1. https://render.com 'a GitHub ile giriş yap (kredi kartı istemez).
2. **New +** → **Blueprint** → GitHub reponu seç.
3. Render `render.yaml`'ı bulur ve “chrome-extensions-backend” servisini önerir. **Apply** de.
4. Açılan **Environment** alanına şu değişkenleri gir (render.yaml'da `sync:false` olanlar):
   - `MONGODB_URI` → Adım 1'deki bağlantı adresi
   - `ADMIN_EMAIL` → admin panel e-postan
   - `ADMIN_PASSWORD` → **güçlü** bir şifre (varsayılan `admin123456` ASLA kullanma)
   - `ALLOWED_ORIGINS` → şimdilik boş bırakabilirsin (eklentiler otomatik izinli)
   - `JWT_SECRET` → Render otomatik üretir, dokunma
   - PAYTR_* → premium satışı açana kadar boş kalabilir
5. **Deploy** de. Birkaç dakikada imaj derlenir. Bitince yukarıda bir URL görürsün:
   ```
   https://chrome-extensions-backend.onrender.com
   ```
6. Test et: tarayıcıda `https://...onrender.com/api/health` aç. `{"success":true,...}`
   görüyorsan backend ayakta. **Bu URL'yi not al** — bir sonraki adımda eklentilere yazacağız.

> Render istersen Docker yerine otomatik Node algılamayı da kullanabilir; ama Puppeteer'ın
> Chromium'u için hazırladığım **Dockerfile** en güvenli yoldur, `render.yaml` zaten onu kullanır.

---

## Adım 4 — Eklentileri yeni adrese yönlendir

Backend canlandıktan sonra 3 eklentide ikişer yeri güncelle (`...onrender.com` kısmını kendi
URL'inle değiştir):

**a) API adresi** — şu 3 dosyada `shared/api-client.js`, en üstteki satır:
```js
// ESKI:
const API_BASE = 'http://localhost:3000/api';
// YENI:
const API_BASE = 'https://chrome-extensions-backend.onrender.com/api';
```
Dosyalar:
- `extensions/ig-follower-export/shared/api-client.js`
- `extensions/ig-unfollow-ai/shared/api-client.js`
- `extensions/price-compare/shared/api-client.js`

**b) İzinli alan adı** — şu 3 `manifest.json` içindeki `host_permissions`:
```jsonc
// ESKI:
"host_permissions": ["*://*.instagram.com/*", "http://localhost:3000/*"]
// YENI (price-compare'de instagram satırı yok):
"host_permissions": ["*://*.instagram.com/*", "https://chrome-extensions-backend.onrender.com/*"]
```

> İstersen bu 4+2 düzenlemeyi senin için ben de yapabilirim; sadece nihai URL'ini söyle.

---

## Adım 5 — Güvenlik kontrol listesi

- [ ] `ADMIN_PASSWORD` varsayılandan değiştirildi
- [ ] `JWT_SECRET` rastgele ve uzun (Render üretti)
- [ ] `MONGODB_URI` içindeki şifre güçlü
- [ ] `.env` dosyası GitHub'a **gitmedi**

---

## Admin paneli (opsiyonel)

`admin-panel/` klasörü ayrı bir statik arayüzdür. Hazırladığım Docker imajı sadece **API**'yi
yayınlar (eklentilerin ihtiyacı budur). Admin paneline ihtiyacın olursa onu ayrıca
ücretsiz statik hosting'e (Netlify/Cloudflare Pages) atıp, içindeki API adresini yukarıdaki
Render URL'ine yönlendirebilirsin.

## Alternatif platformlar
Render yerine **Fly.io** (Docker'a çok uygun, Puppeteer için bol bellek) veya **Railway**
(aylık ücretsiz kredi) de kullanılabilir. Aynı `Dockerfile` üçünde de çalışır.
