# addchrome.com Deployment Rehberi — Adım Adım

Bu rehber, projeyi `addchrome.com` üzerinde canlıya almak için **tüm adımları** sırasıyla anlatır.

## Mimari Özet

```
Chrome Eklentileri  ──→  api.addchrome.com (cPanel)  ──→  MongoDB Atlas
                              │
                              └──→  Render.com (fiyat tarama)
```

| Bileşen | Nerede | Ne Yapıyor |
|---------|--------|------------|
| Ana Backend | api.addchrome.com (cPanel) | Auth, abonelik, ödeme, admin panel |
| Fiyat Tarama | Render.com (ücretsiz) | Puppeteer + Chromium ile tarama |
| Veritabanı | MongoDB Atlas (ücretsiz) | Tüm kullanıcı/ödeme/arama verileri |

---

## ADIM 1: MongoDB Atlas Kurulumu (Veritabanı)

cPanel'de MongoDB yok, bu yüzden MongoDB Atlas (bulut) kullanacağız. **Ücretsiz.**

### 1.1 Hesap Oluştur
1. https://www.mongodb.com/atlas adresine git
2. "Try Free" ile ücretsiz hesap oluştur (Google ile giriş yapabilirsin)

### 1.2 Cluster Oluştur
1. "Create" butonuna tıkla
2. **M0 (Free)** seçeneğini seç (512 MB, ücretsiz)
3. Provider: **AWS** veya **Google Cloud**
4. Region: **Frankfurt (eu-central-1)** — Türkiye'ye en yakın
5. Cluster Name: `chrome-extensions` (istediğin adı ver)
6. "Create Deployment" tıkla

### 1.3 Veritabanı Kullanıcısı Oluştur
1. Sol menüden **Database Access** → **Add New Database User**
2. Authentication: **Password**
3. Username: `addchrome` (istediğin bir kullanıcı adı)
4. Password: **Güçlü bir şifre** oluştur (Auto-generate ile üret) — **ŞİFREYİ NOT AL!**
5. Database User Privileges: **Read and write to any database**
6. "Add User" tıkla

### 1.4 Network Access (IP İzni)
1. Sol menüden **Network Access** → **Add IP Address**
2. **Allow Access from Anywhere** seç → `0.0.0.0/0` eklenir
3. "Confirm" tıkla
   
> Bu, cPanel IP'si sabit olmadığı için gerekli. Production'da isteğe bağlı olarak
> sadece cPanel sunucunuzun IP'sini de ekleyebilirsiniz.

### 1.5 Connection String Al
1. Sol menüden **Database** → cluster'ının yanındaki **Connect** butonuna tıkla
2. **Drivers** seç
3. Bağlantı adresini kopyala. Şuna benzer:
   ```
   mongodb+srv://addchrome:SIFREN@chrome-extensions.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. **ÖNEMLİ:** URL'nin sonuna veritabanı adını ekle:
   ```
   mongodb+srv://addchrome:SIFREN@chrome-extensions.xxxxx.mongodb.net/chrome-extensions?retryWrites=true&w=majority
   ```
5. `SIFREN` kısmını adım 1.3'te oluşturduğun şifreyle değiştir

**Bu adresi not al — ileride `.env` dosyasına yazacaksın.**

---

## ADIM 2: Fiyat Tarama Microservice'i Deploy Et (Render.com)

Puppeteer, cPanel'de çalışamaz (Chromium kurulamaz). Bu yüzden fiyat tarama ayrı bir sunucuda.

### 2.1 GitHub Repo Oluştur
1. https://github.com/new adresinden **yeni bir repository** oluştur
   - Repo adı: `addchrome-services` (veya istediğin)
   - **Private** yap
2. Projeyi pushla:
   ```powershell
   cd "c:\Users\oguzy\chrome eklentiler"
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/KULLANICI/addchrome-services.git
   git push -u origin main
   ```

### 2.2 Render.com'a Deploy Et
1. https://render.com adresine git → **GitHub ile giriş** yap (kredi kartı istemez)
2. **New +** → **Blueprint** seç
3. GitHub reposunu seç (`addchrome-services`)
4. Render, `render.yaml` dosyasını otomatik bulur ve `addchrome-price-scraper` servisini önerir
5. **Environment** bölümünde şu değişkeni gir:
   - `SCRAPER_API_KEY` = `ef6867262ed2bfdf30619aee63c543c6cb861f727785aba8d01b6392b05cf133`
6. **Apply** → Deploy başlar

### 2.3 Deploy'u Bekle ve Test Et
Deploy birkaç dakika sürer (Chromium indiriliyor). Bitince URL'i göreceksin:
```
https://addchrome-price-scraper.onrender.com
```

Test et:
```
https://addchrome-price-scraper.onrender.com/health
```
`{"success":true,...}` görüyorsan çalışıyor! 🎉

> **NOT:** Render ücretsiz katmanda, 15 dakika istek gelmezse servis uyur.
> İlk istek geldiğinde ~30-60 saniyede uyanır. Bu normaldir.

---

## ADIM 3: cPanel'de SSH Bağlantısı Kur

### 3.1 SSH Anahtarı Oluştur
1. cPanel'e giriş yap
2. **SSH Access** (veya **SSH/Shell Access** / **Terminal**) bölümüne git
3. **Generate a New Key** tıkla:
   - Key Name: `id_rsa` (varsayılan bırak)
   - Password: bir şifre belirle (veya boş bırak)
   - Key Type: RSA, 2048 bit
4. "Generate Key" tıkla
5. Oluşturulan anahtarı **Authorize** et (Manage → Authorize)

### 3.2 Özel Anahtarı Bilgisayarına İndir
1. **Private Keys** bölümünden `id_rsa` yanındaki **View/Download** tıkla
2. Private key'i kopyala
3. Bilgisayarında `C:\Users\oguzy\.ssh\addchrome_rsa` dosyasına kaydet

### 3.3 SSH ile Bağlan (Test)
```powershell
ssh -i C:\Users\oguzy\.ssh\addchrome_rsa KULLANICI@addchrome.com -p 22
```
> Port 22 olmayabilir, cPanel'de SSH bilgilerinden doğru portu kontrol et.

Bağlandıktan sonra:
```bash
node -v    # Node.js versiyonunu kontrol et (20.x olmalı)
npm -v     # npm versiyonunu kontrol et
```

---

## ADIM 4: cPanel'de api.addchrome.com Subdomain Oluştur

### 4.1 Subdomain Ekle
1. cPanel → **Domains** (veya **Subdomains**) bölümüne git
2. **Create a New Domain** (veya **Add Subdomain**) tıkla
   - Domain: `api.addchrome.com`
   - Document Root: `api.addchrome.com` (veya `public_html/api.addchrome.com`)
3. "Submit" / "Create" tıkla

### 4.2 SSL Sertifikası
1. cPanel → **SSL/TLS** veya **Let's Encrypt** bölümüne git
2. `api.addchrome.com` için SSL sertifikası oluştur
   - Çoğu cPanel'de **AutoSSL** otomatik oluşturur (birkaç dakika bekle)
   - Yoksa **Let's Encrypt** ile ücretsiz oluşturabilirsin

---

## ADIM 5: Node.js Uygulamasını Kur (cPanel)

### 5.1 Node.js App Oluştur
1. cPanel → **Setup Node.js App** bölümüne git
2. **Create Application** tıkla
3. Ayarları şöyle doldur:

| Ayar | Değer |
|------|-------|
| **Node.js version** | 20.x (mevcut en yüksek) |
| **Application mode** | Production |
| **Application root** | `api.addchrome.com` |
| **Application URL** | `api.addchrome.com` |
| **Application startup file** | `src/server.js` |

4. "Create" tıkla

### 5.2 Dosyaları Yükle

**Yöntem A — SCP ile (SSH varsa, önerilen):**
```powershell
# Bilgisayarından dosyaları yükle
scp -i C:\Users\oguzy\.ssh\addchrome_rsa -r "c:\Users\oguzy\chrome eklentiler\backend\*" KULLANICI@addchrome.com:~/api.addchrome.com/
```

**Yöntem B — cPanel File Manager ile:**
1. cPanel → **File Manager** aç
2. `api.addchrome.com` dizinine git
3. Backend klasöründeki dosyaları yükle:
   - `src/` klasörü (tüm alt dosyalarıyla)
   - `package.json`
   - `package-lock.json`
   - `.env` dosyası
   
> **ÖNEMLİ:** `node_modules/` klasörünü YÜKLEME — sunucuda `npm install` ile kurulacak.
> **ÖNEMLİ:** `admin-panel/` klasörünü de yükle (backend'in 2 üst dizinine, yani `api.addchrome.com/` ile aynı seviyeye bir üst dizine). Veya server.js'deki admin panel yolunu güncelleriz.

### 5.3 Admin Panel'i Doğru Konuma Koy

Admin panel, server.js'de `../../admin-panel` yoluna bakıyor. cPanel'de bu yolu ayarlamak için:

SSH ile bağlanıp:
```bash
cd ~/api.addchrome.com
mkdir -p admin-panel
```

Sonra admin-panel dosyalarını `~/api.addchrome.com/admin-panel/` dizinine yükle.

> Ben server.js'deki yolu da güncelleyeceğim, bir sonraki adımda.

### 5.4 .env Dosyasını Düzenle

SSH ile veya cPanel File Manager ile `.env` dosyasını düzenle:

```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb+srv://addchrome:GERCEK_SIFRE@chrome-extensions.xxxxx.mongodb.net/chrome-extensions?retryWrites=true&w=majority
JWT_SECRET=ce6908c6e0b73193646758aae4498026e8cfab2a1a4ba5d1a018cf68a4b3b695dc4aa36a5608b71b07b6765304592f96
JWT_EXPIRES_IN=30d
ADMIN_EMAIL=admin@addchrome.com
ADMIN_PASSWORD=GUCLU_BIR_SIFRE_YAZ
SCRAPER_SERVICE_URL=https://addchrome-price-scraper.onrender.com
SCRAPER_API_KEY=ef6867262ed2bfdf30619aee63c543c6cb861f727785aba8d01b6392b05cf133
PAYTR_MERCHANT_ID=
PAYTR_MERCHANT_KEY=
PAYTR_MERCHANT_SALT=
PAYTR_OK_URL=https://api.addchrome.com/api/payment/success
PAYTR_FAIL_URL=https://api.addchrome.com/api/payment/fail
PAYTR_CALLBACK_URL=https://api.addchrome.com/api/payment/webhook
ALLOWED_ORIGINS=https://addchrome.com,https://api.addchrome.com
```

**Değiştirmen gereken 2 değer:**
1. `MONGODB_URI` → Adım 1.5'te aldığın gerçek bağlantı adresi
2. `ADMIN_PASSWORD` → Güçlü bir şifre

### 5.5 Bağımlılıkları Kur

cPanel Node.js App arayüzünde "Run NPM Install" butonuna tıkla.

Veya SSH ile:
```bash
cd ~/api.addchrome.com
source /home/KULLANICI/nodevenv/api.addchrome.com/20/bin/activate
npm install --omit=dev
```

> cPanel'deki Node.js sanal ortamının yolu hosting firmasına göre değişebilir.
> "Setup Node.js App" sayfasında "Enter to the virtual environment" komutunu görebilirsin.

### 5.6 Uygulamayı Başlat/Yeniden Başlat

cPanel → **Setup Node.js App** → uygulamanın yanındaki **Restart** butonuna tıkla.

---

## ADIM 6: Test Et

### 6.1 Health Check
Tarayıcıda aç:
```
https://api.addchrome.com/api/health
```
Şu yanıtı görmelisin:
```json
{"success":true,"message":"Chrome Extensions API is running","version":"1.0.0","environment":"production"}
```

### 6.2 Admin Panel
```
https://api.addchrome.com/admin
```
E-posta ve şifreyle giriş yap.

### 6.3 Fiyat Tarama (uçtan uca)
Chrome eklentisini yükle, giriş yap, bir ürün ara. Sonuçlar gelmeli.

---

## ADIM 7: Sorun Giderme

### "502 Bad Gateway" veya Site Açılmıyor
- cPanel → Setup Node.js App → Restart
- SSH ile log kontrol et: `cat ~/api.addchrome.com/stderr.log`

### MongoDB Bağlantı Hatası
- `MONGODB_URI` doğru mu kontrol et (şifrede özel karakter varsa URL-encode et)
- Atlas → Network Access'te `0.0.0.0/0` var mı kontrol et

### Fiyat Tarama Çalışmıyor
- `SCRAPER_SERVICE_URL` ve `SCRAPER_API_KEY` doğru mu kontrol et
- Render.com dashboard'dan servis durumunu kontrol et
- İlk istekte Render servisi uyandığı için 30-60 saniye beklenmeli

### Admin Panel Yüklenmiyor
- Admin panel dosyaları doğru konumda mı kontrol et
- server.js'deki path'in doğru olduğunu doğrula

---

## Güvenlik Kontrol Listesi

- [ ] `ADMIN_PASSWORD` güçlü ve benzersiz
- [ ] `JWT_SECRET` rastgele ve uzun (✅ zaten üretildi)
- [ ] `SCRAPER_API_KEY` sadece iki servis arasında biliniyor (✅ zaten üretildi)
- [ ] MongoDB şifresi güçlü
- [ ] `.env` dosyası git'e gitmedi (`.gitignore`'da ✅)
- [ ] SSL/HTTPS aktif ve zorunlu
- [ ] CORS sadece izinli origin'lere açık
