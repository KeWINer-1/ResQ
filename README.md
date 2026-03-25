# ResQ

ResQ egy webes autómentő-közvetítő alkalmazás, amit vizsgaremek projektként készítettünk.
A célunk az volt, hogy a bajba jutott autósok gyorsan találjanak elérhető autómentőt térképes nézetben, miközben a szolgáltatók is egyszerűen kezelni tudják a beérkező munkákat.

## Projekt röviden

A rendszer 3 fő szerepkört kezel:
- Felhasználó (autós)
- Szolgáltató (autómentő)
- Admin

Fő funkciók:
- regisztráció / bejelentkezés
- JWT alapú hitelesítés és szerepkörkezelés
- térképes keresés (Leaflet + OSM)
- közeli autómentők listázása
- mentési kérés indítása és státusz követés
- szolgáltatói státuszkezelés (online/offline, elfogadva, úton, megérkezett, lezárt)
- felhasználó-szolgáltató chat
- admin support felület

## Technológiai stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Adatbázis: Microsoft SQL Server
- Térkép: Leaflet + OpenStreetMap
- Útvonal/ETA: OSRM API
- Geokódolás: Nominatim API
- Auth: JWT

## Projekt struktúra

```text
ResQ/
├─ backend/            # API + auth + üzleti logika
├─ public/             # frontend oldalak és statikus fájlok
├─ database/           # SQL script + DB export fájlok
├─ deploy/             # szerveres indítási / publish segédfájlok
├─ Dockerfile
├─ docker-compose.publish.yml
└─ ecosystem.config.cjs
```

## Local fejlesztés

### 1) Backend

```powershell
cd backend
npm install
npm run dev
```

Alapértelmezetten a backend a `5000` porton fut.

### 2) Frontend

```powershell
cd public
npx serve .
```

A frontend fejlesztés közben külön is futtatható, de productionben a backend kiszolgálja a `public` mappát.

## Környezeti változók

A backendhez szükséges egy `.env` fájl a `backend` mappában.

Példa:

```env
DB_USER=sa
DB_PASSWORD=your_password
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=ResQ
JWT_SECRET=very-long-random-secret
CORS_ORIGIN=http://localhost:3000
PORT=5000
```

Productionhöz használható minta:
- `backend/.env.production.example`

## Adatbázis

A projekt SQL Serverre épül.
A `database` mappában találhatók:
- SQL script(ek)
- export fájlok (`.bacpac`, `.zip`)

A futtatás előtt ellenőrizni kell, hogy:
- az SQL Server elérhető
- a megadott user jogosult a kiválasztott adatbázisra
- a tűzfal engedi a használt portot

## Futtatás production környezetben

### Dockerrel

```powershell
docker compose -f docker-compose.publish.yml up -d --build
```

### Docker nélkül (PM2)

```powershell
npm install -g pm2
cd D:\Projekt\ResQ
pm2 start ecosystem.config.cjs
pm2 save
```

Vagy sima Node indítás:

```powershell
cd D:\Projekt\ResQ\backend
$env:NODE_ENV="production"
node src/server.js
```

## Deploy jegyzet

- A domain DNS `A` rekordja mutasson a szerver IP-jére.
- Reverse proxy ajánlott (IIS + ARR, Nginx vagy Caddy).
- HTTPS-hez érdemes proxy oldalon tanúsítványt kezelni.

## Készítők

- Bozsányi Kevin
- Seres Alex Achilles

## Projekt státusz

Vizsgaremek projekt, aktív fejlesztés és finomhangolás alatt.
