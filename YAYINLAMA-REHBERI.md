# Chrome Web Store Yayınlama Rehberi

3 eklentiyi (Takipçi Dışa Aktar, Unfollow AI, Fiyat Karşılaştır) Chrome Web Store'a
yüklemek için adım adım rehber.

---

## Doğru sıra (önce bunları yap)

Eklentileri zip'lemeden **önce** şu üç şey bitmiş olmalı, yoksa zip mağazaya uygun olmaz:

1. **Backend'i yayına al** ve gerçek bir URL elde et → `SUNUCU-KURULUM-REHBERI.md`
2. **Eklentileri o URL'e yönlendir** (`api-client.js` + `manifest.json`) → yine sunucu rehberinde
3. **Gerçek ikonları üret** → proje kökünde: `npm install sharp` sonra `node generate-icons.js`
   (yoksa ikonlar 1x1 boş kare kalır ve mağaza reddeder)

Sonra paketle:
```
powershell -ExecutionPolicy Bypass -File .\package-extensions.ps1
```
Bu komut `dist\` klasörüne 3 adet mağazaya hazır zip üretir (manifest.json zip kökünde).

---

## Adım 1 — Geliştirici hesabı (tek seferlik 5 USD)

1. https://chrome.google.com/webstore/devconsole adresine Google hesabınla gir.
2. İlk girişte **tek seferlik 5 USD** kayıt ücretini öde. Bu ücret ömür boyu geçerli ve
   tek hesapla **20 eklentiye kadar** yayın yapabilirsin (3'ü de bu hesaba sığar).
3. İpucu: kişisel hesabın yerine bu iş için ayrı bir Google hesabı kullan.

## Adım 2 — Gizlilik politikasını yayına al

Her eklentinin bir gizlilik politikası URL'i olmalı (veri topladıkları için zorunlu).
`privacy-policies/` klasöründe hazır 3 HTML dosyası var. İçlerindeki `[E-POSTA_ADRESINIZ]`
kısmını doldur, sonra herhangi bir ücretsiz yere koy:
- En kolay: Netlify Drop (https://app.netlify.com/drop) — klasörü sürükle, anında URL al.
- Ya da GitHub Pages / kendi sitenin bir sayfası.

Her eklentiye kendi politikasının URL'ini gireceksin.

## Adım 3 — Yeni öğe ekle ve zip yükle

Panelde **Add new item** → `dist\ig-follower-export.zip` dosyasını yükle. Yükleme
başarılıysa listeleme formu açılır. (Diğer ikisini de sırayla yapacaksın.)

## Adım 4 — Mağaza bilgilerini doldur

Hazırladığım `*_logo-icon-paketi.zip` paketlerindeki dosyalar buraya gelir:

| Alan | Ne koyacaksın |
|------|----------------|
| İsim / Açıklama | `_locales`'teki Türkçe isim ve açıklama otomatik gelir |
| Mağaza ikonu | `chrome-web-store/store_icon_128.png` (128×128, zorunlu) |
| Ekran görüntüleri | **1280×800** (en az 1 tane) — eklentinin gerçek arayüzünden alacaksın |
| Küçük tanıtım | `chrome-web-store/promo_small_440x280.png` (önerilir) |
| Marquee tanıtım | `chrome-web-store/promo_marquee_1400x560.png` (opsiyonel) |
| Kategori | Fiyat Karşılaştır → “Shopping”; IG araçları → “Social & Communication” |
| Dil | Türkçe (gerekirse İngilizce de ekle) |
| Gizlilik politikası | Adım 2'deki URL |

## Adım 5 — İzin gerekçeleri (önemli!)

Form, istenen her izin için **neden gerektiğini** sorar. İncelemeci bunları okur; boş veya
gereksiz geniş izinler en sık ret sebebidir. Önerilen kısa açıklamalar:

**Takipçi Dışa Aktar / Unfollow AI:**
- `storage`: Kullanıcının oturum bilgisini ve tercihlerini saklamak için.
- `scripting` + `activeTab`: Yalnızca kullanıcı Instagram'dayken, kendi oturumu üzerinden
  takipçi/takip verisini okuyup işlemek için.
- Instagram host izni: Eklentinin tek işlevi Instagram sayfasında çalışmaktır.
- Backend host izni: Giriş ve abonelik doğrulaması için kendi sunucumuzla iletişim.
- **“Remote code” sorusu:** Hayır — tüm kod pakette gelir, uzaktan kod çalıştırılmaz.
- **Veri kullanımı:** Instagram liste verisi sunucuya gönderilmez, kullanıcının tarayıcısında
  işlenip indirilir. (Gizlilik politikasıyla aynı şeyi söyle.)

**Fiyat Karşılaştır:**
- `storage`: Oturum ve tercih saklama.
- Backend host izni: Arama sorgusunu gönderip fiyat sonuçlarını almak için.
- Veri kullanımı: Sadece arama sorgusu işlenir; sayfa içeriği okunmaz.

## Adım 6 — Gönder ve bekle

**Submit for review** de. İnceleme genelde birkaç gün, bazen birkaç hafta sürer.
Onaylanınca eklenti mağazada yayına girer. Aynı adımları diğer iki eklenti için tekrarla.

---

## Bilmen gereken riskler

- **Instagram araçları:** Takipçi dışa aktarma ve toplu takipten çıkarma, Instagram'ın
  kullanım şartlarına ve Web Store'un otomasyon/veri politikalarına takılabilir; bu ikisi
  reddedilirse şaşırma. **Fiyat Karşılaştır** bu açıdan en güvenli olanı.
- **Marka:** Listelemede Instagram'ın resmi logosunu/adını marka gibi öne çıkarma;
  “Instagram için” gibi açıklayıcı dil kullan. (İkonlar bu yüzden özgün tasarlandı.)
- **Tek gizlilik politikası kuralı:** Aynı geliştirici hesabında ortak bir politika
  linki de verebilirsin; ama her eklentiye kendi sayfasını vermek en temizi.

## Güncelleme (sonra)

Kod veya ikon değiştirdiğinde: `manifest.json` içindeki `version`'ı artır (ör. 1.0.0 → 1.0.1),
tekrar `package-extensions.ps1` çalıştır, panelde **Package → Upload new package** ile yeni
zip'i yükle ve tekrar gönder.
