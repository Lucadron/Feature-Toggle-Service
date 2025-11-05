# Feature Toggle Serevice
📖 [View this README in English (README.md)](README.md)

## Genel Bakış

Bu proje, çok kiracılı (multi-tenant) bir Feature Toggle Servisi uygulamasıdır. Birden fazla kiracının, REST API aracılığıyla farklı ortamlara (dev, staging, prod) dayalı olarak özellik bayraklarını yönetmesine ve almasına olanak tanır.

Servis, JWT ile kimlik doğrulama, yüksek performans için Redis ile önbelleğe alma, kiracı bazlı hız sınırlama, detaylı denetim kaydı ve işlevsel bir React tabanlı admin arayüzü dahil olmak üzere üretime hazır bir anlayışla oluşturulmuştur.

## Temel Özellikler

* **Çok Kiracılı ve Ortam Bazlı:** Özellik bayrakları, kiracıya ve ortama (`dev`, `staging`, `prod`) göre saklanır ve alınır.
* **Güvenli REST API:** Servisi yönetmek için eksiksiz bir endpoint seti sunar:
    * `POST /auth/token`: JWT yayınlamak için `apiKey` ve `apiSecret` kullanarak kiracıların kimliğini doğrular.
    * `GET /features`: Bir kiracı/ortam için değerlendirilmiş özellik bayraklarını alır. Sayfalamayı, isme göre filtrelemeyi (`filter`) destekler ve sonuçlar Redis'te önbelleğe alınır.
    * `POST /features`: Belirli bir kiracı, özellik ve ortam için bir özellik bayrağı oluşturur veya günceller (upsert). Önbelleği geçersiz kılar ve değişikliği loglar.
    * `DELETE /features/{id}`: Belirli bir özellik bayrağı örneğini benzersiz ID'si ile siler. Önbelleği geçersiz kılar ve değişikliği loglar.
    * `GET /audit`: Kimliği doğrulanmış kiracı için sayfalanmış denetim günlüklerini (audit log) alır.
    * `POST /promote`: Tüm bayrakları bir ortamdan (örn: staging) diğerine (örn: prod) tek bir işlemde yükseltir.
* **Kimlik Doğrulama:** Tüm API endpoint'lerini ( `/auth/token` ve `/health` hariç) güvence altına almak için JWT (JSON Web Tokens) kullanır.
* **Önbelleğe Alma (Caching):** Hızlı okumalar sağlamak için `GET /features` istekleri için bir Redis önbellek katmanı uygular. Önbellek, herhangi bir yazma işleminde (`POST`, `DELETE`, `PROMOTE`) otomatik olarak geçersiz kılınır.
* **Değerlendirme Stratejileri:** `GET /features` isteklerinde anlık olarak uygulanan `BOOLEAN` (Doğru/Yanlış) ve `PERCENTAGE` (Yüzdelik) dağıtım stratejilerini destekler.
* **Denetim Kaydı (Audit Logging):** Tüm C/U/D ve yükseltme eylemlerini, gerçekleştiren aktör, zaman damgası ve değişikliklerin bir JSON 'diff'i dahil olmak üzere bir `audit_logs` tablosuna kaydeder.
* **Hız Sınırlama (Rate Limiting):** Kötüye kullanımı önlemek için güvenli tüm endpoint'lerde Redis destekli, kiracı başına hız sınırlaması uygular.
* **Gözlemlenebilirlik (Observability):** `/metrics` endpoint'inde, HTTP istekleri ve özellik bayrağı değerlendirmeleri için sayaçlar da dahil olmak üzere Prometheus uyumlu metrikleri sunar.
* **API Dokümantasyonu:** `/api-docs` adresinden erişilebilen **Swagger UI** kullanarak interaktif API dokümantasyonu sağlar.
* **Frontend Admin Arayüzü (UI):** React, TypeScript ve Tailwind CSS ile oluşturulmuş eksiksiz, işlevsel, tek sayfalık bir admin paneli. Arayüz kullanıcıların şunları yapmasına olanak tanır:
    * JWT kullanarak kimlik doğrulama.
    * Ortam seçme.
    * Seçilen ortam için tüm özellik bayraklarını (sayfalanmış) görüntüleme.
    * Bayrakları açma/kapatma.
    * Yeni özellik bayrakları oluşturma.
    * Özellik bayraklarını silme.

## Kullanılan Teknolojiler

| Alan | Teknoloji | Amaç |
| :--- | :--- | :--- |
| **Backend** | Node.js, Express.js | Sunucu çalışma zamanı ve framework |
| | TypeScript | Tip güvenliği ve modern JavaScript |
| **Veritabanı** | PostgreSQL | Birincil veri depolama |
| **ORM** | Prisma | Veritabanı erişimi, şema yönetimi ve migrasyon |
| **Önbelleğe Alma** | Redis | `GET /features` yanıtlarını önbelleğe alma |
| **Hız Sınırlama** | Redis | Hız sınırı sayaçlarını depolama (via `rate-limit-redis`) |
| **Auth** | JWT (jsonwebtoken), bcrypt | Token oluşturma/doğrulama ve şifre hashing |
| **API Docs** | Swagger (swagger-jsdoc, swagger-ui-express) | İnteraktif API dokümantasyonu |
| **Gözlemlenebilirlik** | Prometheus (prom-client) | `/metrics` üzerinden metrikleri sunma |
| **Test** | Jest, Supertest | API endpoint'leri için entegrasyon testleri |
| **Konteyner** | Docker, Docker Compose | Yardımcı servisleri (Postgres, Redis) çalıştırma |
| **Frontend** | React, Vite | UI kütüphanesi ve build aracı |
| | TypeScript | Frontend için tip güvenliği |
| | Tailwind CSS | Hızlı stilizasyon için utility-first CSS framework'ü |
| | Axios | Backend ile iletişim için HTTP istemcisi |

## Proje Yapısı

Bu repository, bir monorepo (tek depo) olarak yapılandırılmıştır; hem backend servisini hem de frontend arayüzünü aynı depoda barındırır.

* `/` (Kök Dizin): Backend Node.js/Express servisi.
* `/feature-toggle-service-ui`: Frontend React/Vite uygulaması.

## Kurulum ve Çalıştırma

**Ön Gereksinimler:**
* Node.js (v18.x veya v20.x önerilir)
* npm (v8.x veya üstü)
* Docker & Docker Compose

### 1. Backend Kurulumu (Ana Servis)

1.  **Backend dizinine gidin** (bu repository'nin kök dizini):
    ```bash
    cd feature-toggle-service
    ```
2.  **Backend bağımlılıklarını yükleyin:**
    ```bash
    npm install
    ```
3.  **Ortam Değişkenlerini Ayarlayın:**
    * Bir `.env` dosyası oluşturun (`.env.example` dosyasını kopyalayabilirsiniz).
    * `DATABASE_URL`'in Docker kurulumuyla eşleştiğinden emin olun ve bir `JWT_SECRET` ekleyin.
    * *Örnek `.env`:*
        ```env
        DATABASE_URL="postgresql://zebra:password@localhost:5432/feature_toggles?schema=public"
        JWT_SECRET="COK_GIZLI_ANAHTARINIZ_BURAYA"
        CACHE_TTL=60
        ```
4.  **Docker Servislerini Başlatın (Postgres & Redis):**
    ```bash
    npm run db:up
    # Konteynerlerin 'healthy' (sağlıklı) olmasını bekleyin ('docker ps' ile kontrol edin)
    ```
5.  **Veritabanı Migrasyonlarını Çalıştırın:**
    ```bash
    npx prisma migrate dev
    ```
6.  **Başlangıç Verilerini Yükleyin (Seed):**
    ```bash
    npm run prisma:seed
    ```
7.  **Backend Sunucusunu Başlatın (Development Modu):**
    ```bash
    npm run dev
    # Backend sunucusu http://localhost:3000 adresinde çalışacaktır
    ```

### 2. Frontend Kurulumu (UI)

1.  **Yeni bir terminal açın.**
2.  **Frontend dizinine gidin:**
    ```bash
    cd feature-toggle-service-ui
    ```
3.  **Frontend bağımlılıklarını yükleyin:**
    ```bash
    npm install
    ```
4.  **Frontend Sunucusunu Başlatın (Development Modu):**
    ```bash
    npm run dev
    # Frontend UI, Vite tarafından sağlanan adreste çalışacaktır (örn: http://localhost:5173)
    ```

### 3. Uygulamaya Erişim

* **API Servisi:** `http://localhost:3000`
* **API Dokümantasyonu:** `http://localhost:3000/api-docs`
* **Metrikler:** `http://localhost:3000/metrics`
* **Admin UI:** `http://localhost:5173`

UI'ı kullanmak için, önce API'den (`/auth/token` endpoint'inden Swagger/Postman aracılığıyla, `apiKey: "zebra_api_key"` ve `apiSecret: "zebra_secret_123"` kullanarak) bir token alın ve bu token'ı UI'daki giriş alanına yapıştırın.

## Testleri Çalıştırma

Backend entegrasyon testlerini çalıştırmak için:

```bash
# Kök (backend) dizinindeyken
npm test
