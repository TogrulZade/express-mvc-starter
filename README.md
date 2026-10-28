# Express MVC Starter — Mongoose

Laravel bilənlər üçün Express 4 MVC başlanğıcı. Bu repozitoriyada üç ayrı şablon var:

| Branch | ORM | Baza |
| --- | --- | --- |
| `main` | Prisma | PostgreSQL |
| `sequelize` | Sequelize | PostgreSQL |
| `mongoose` | Mongoose | MongoDB |

## Başlamaq

Node.js 22 və ya daha yeni versiya, npm və işlək MongoDB lazımdır.

```bash
npm install
cp .env.example .env
# .env içində MONGO_URI dəyərini öz bazana uyğun dəyiş.
npm run dev
```

MongoDB serverini əvvəl başlat. Bu branch SQL migration istifadə etmir. Server qoşulanda `users` kolleksiyasının unikal email indeksi yaradılır; indeks yaratmaq icazəsi lazımdır. Mövcud bazada təkrar email varsa əvvəl həmin məlumatları düzəlt.

Production-da `npm ci --omit=dev`, sonra `NODE_ENV=production npm start` istifadə et. MongoDB-də ayrıca istifadəçi və layihənə uyğun baza icazələri qur.

## Laravel ilə müqayisə

| Laravel | Bu layihə |
| --- | --- |
| `routes/api.php` | `src/routes/index.js`, `userRoutes.js` |
| Controller | `src/controllers/UserController.js` |
| Form Request | `src/middlewares/validate.js` və Zod schema |
| Exception handler | `src/middlewares/errorHandler.js` |
| Eloquent və migrations | Mongoose modeli: `src/models/User.js` |
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

## Parametrlər və test

`.env.example` nümunədir; `.env` Git-ə daxil edilmir. `PORT` standart olaraq `3000`-dir. `CORS_ORIGIN` üçün vergüllə ayrılmış dəqiq frontend origin-lərini yaz, məsələn `http://localhost:5173`. Boş saxlasan browser üçün cross-origin icazəsi verilmir. CORS autentifikasiya deyil.

```bash
npm test
```

Testlər HTTP sərhədini və xəta cavablarını database olmadan yoxlayır. Real database ilə yaratma/siyahılama üçün yuxarıdakı curl əmrlərindən istifadə et.

Bu başlanğıcda endpoint-lər açıqdır: login, istifadəçi icazələri və səhifələmə daxil deyil. İctimai istifadəçi məlumatı API-si kimi yayımlamazdan əvvəl tətbiqinə uyğun giriş qaydalarını əlavə et. ORM branch-ləri alternativlərdir, eyni tətbiqə merge edilməməlidir. Branch dəyişəndə `npm ci` işlə və `.env`-i seçilən branch-in `.env.example` faylına uyğunlaşdır.

## Mənbələr

[Express](https://expressjs.com/), [Prisma](https://www.prisma.io/docs), [Sequelize migrations](https://sequelize.org/docs/v6/other-topics/migrations/).
