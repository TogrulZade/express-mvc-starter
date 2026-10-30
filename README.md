# Express MVC Starter — Prisma

Laravel bilənlər üçün Express 4 MVC başlanğıcı. Bu repozitoriyada üç ayrı şablon var:

| Branch | ORM | Baza |
| --- | --- | --- |
| `main` | Prisma | PostgreSQL |
| `sequelize` | Sequelize | PostgreSQL |
| `mongoose` | Mongoose | MongoDB |

## Başlamaq

Node.js 22 və ya daha yeni versiya, npm və işlək PostgreSQL lazımdır.

```bash
npm install
cp .env.example .env
# .env içində DATABASE_URL dəyərini öz bazana uyğun dəyiş.
npm run db:generate
npm run db:deploy
npm run dev
```

Əvvəl PostgreSQL-də boş baza yarat. `db:deploy` repozitoriyadakı migration-ları tətbiq edir. `db:migrate -- --name change_name` schema dəyişəndə development bazasında yeni migration yaradır. `db:studio` bazanı brauzerdə açır. Migration fayllarını Git-ə əlavə et.

Production build mərhələsində `npm ci`, `npm run db:generate`, sonra migration icazəli deployment mərhələsində `npm run db:deploy` işlə. Serveri `NODE_ENV=production npm start` ilə başlat. Migration alətləri devDependencies-dədir, ona görə həmin mərhələdən əvvəl onları çıxarma.

## Laravel ilə müqayisə

| Laravel | Bu layihə |
| --- | --- |
| `routes/api.php` | `src/routes/index.js`, `userRoutes.js` |
| Controller | `src/controllers/UserController.js` |
| Form Request | `src/middlewares/validate.js` və Zod schema |
| Exception handler | `src/middlewares/errorHandler.js` |
| Eloquent və migrations | Prisma client və `prisma/` |
| `Cache` facade | `src/services/cache.js` |
| `php artisan serve` | `npm run dev` |

Sorğu → middleware → route → controller → ORM → JSON cavabı.

`src/app.js` yalnız Express tətbiqini qurur; testlər port açmadan onu import edə bilər. `src/server.js` əvvəl bazaya qoşulur, sonra HTTP serverini açır. SIGINT/SIGTERM zamanı bağlantılar bağlanır.

## API

- `GET /api/health`: prosesin health cavabı (bazaya canlı sorğu deyil).
- `GET /api/users`: istifadəçi siyahısı.
- `POST /api/users`: istifadəçi yaratmaq; body: `name`, `email`.

```bash
curl http://localhost:3000/api/health
curl -i -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ali","email":"ali@example.com"}'
curl http://localhost:3000/api/users
```

Uğurlu create: `201`, yanlış sahələr: `422`, təkrar email: `409`, yanlış JSON: `400`, böyük body: `413`, olmayan route: `404`. Email kiçik hərflərə çevrilir. Gözlənilməyən server xətasının detalları production cavabında göstərilmir.

## Cache

Laravel-dəki `Cache` facade-ə bənzər servis hazırdır: `src/services/cache.js`. Standart olaraq yaddaşda (`memory`) işləyir, əlavə server tələb etmir.

```js
import cache from '../services/cache.js';

await cache.put('key', { a: 1 }, 600);      // Cache::put('key', $value, 600)
await cache.get('key', 'default');          // Cache::get('key', 'default')
await cache.has('key');                     // Cache::has('key')
await cache.remember('users:all', 60, () => prisma.user.findMany()); // Cache::remember(...)
await cache.forget('key');                  // Cache::forget('key')
await cache.flush();                        // Cache::flush()
```

TTL saniyə ilə verilir. TTL verilməsə `CACHE_TTL` istifadə olunur, `0` isə açarı silir. Dəyərlər JSON kimi saxlanır. Tarixlər string kimi geri qayıdır, `BigInt`, funksiya və `undefined` saxlanmır. Eyni açar üçün eyni anda gələn `remember` sorğuları loader-i bir dəfə işlədir. Loader xəta versə nəticə cache-ə yazılmır.

Nümunə `UserController`-dədir: `GET /api/users` siyahını 60 saniyə cache-dən verir, `POST /api/users` isə həmin açarı silir.

| `.env` | Standart | Mənası |
| --- | --- | --- |
| `CACHE_DRIVER` | `memory` | `memory` və ya `redis` |
| `CACHE_TTL` | `300` | Standart müddət, saniyə |
| `CACHE_PREFIX` | `<package adı>:cache:` | Açar prefiksi, `:` ilə bitməlidir |
| `CACHE_MAX_ITEMS` | `1000` | `memory` üçün maksimum açar sayı. Dolanda ən çox vaxtdır istifadə olunmayan açar silinir |
| `CACHE_MAX_VALUE_BYTES` | `262144` | Bir dəyərin maksimum ölçüsü |
| `CACHE_TIMEOUT_MS` | `2000` | Redis bağlantı və əmr timeout-u |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Yalnız `CACHE_DRIVER=redis` olanda |

`memory` hər prosesin öz yaddaşıdır: restart olanda silinir, bir neçə proses (PM2 cluster, bir neçə konteyner) arasında paylaşılmır. Belə hallarda `CACHE_DRIVER=redis` seç. Redis-ə qoşulma ilk istifadədə baş verir. Redis əlçatmazdırsa cache əmri parolu göstərməyən xəta atır. `flush()` Redis-də yalnız bu prefiksli açarları silir, `FLUSHDB` çağırmır.

## Parametrlər və test

`.env.example` nümunədir; `.env` Git-ə daxil edilmir. `PORT` standart olaraq `3000`-dir. `CORS_ORIGIN` üçün vergüllə ayrılmış dəqiq frontend origin-lərini yaz, məsələn `http://localhost:5173`. Boş saxlasan browser üçün cross-origin icazəsi verilmir. CORS autentifikasiya deyil.

```bash
npm test
```

Testlər HTTP sərhədini, xəta cavablarını və cache-i database olmadan yoxlayır. Redis testi üçün yazmaq təhlükəsiz olan bir Redis göstər: `TEST_REDIS_URL=redis://127.0.0.1:6379 npm test`. Real database ilə yaratma/siyahılama üçün yuxarıdakı curl əmrlərindən istifadə et.

Bu başlanğıcda endpoint-lər açıqdır: login, istifadəçi icazələri və səhifələmə daxil deyil. İctimai istifadəçi məlumatı API-si kimi yayımlamazdan əvvəl tətbiqinə uyğun giriş qaydalarını əlavə et. ORM branch-ləri alternativlərdir, eyni tətbiqə merge edilməməlidir. Branch dəyişəndə `npm ci` işlə və `.env`-i seçilən branch-in `.env.example` faylına uyğunlaşdır.

## Mənbələr

[Express](https://expressjs.com/), [Prisma](https://www.prisma.io/docs), [Sequelize migrations](https://sequelize.org/docs/v6/other-topics/migrations/).
