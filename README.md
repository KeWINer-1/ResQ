# ResQ

## Local fejlesztes

### Backend
```powershell
cd backend
npm run dev
```

### Frontend
```powershell
cd public
npx serve .
```

## Publish domainre

A projekt most mar egyetlen Node szerverrol is tud futni:
- a backend kiszolgalja az API-t
- a backend kiszolgalja a `public` mappat is
- productionben a frontend automatikusan ugyanarra a domainre kuldi az API hivasokat

### 1. Production env letrehozasa

Masold ezt:
- [backend/.env.production.example](D:/ResQ/backend/.env.production.example)

Erre:
- `backend/.env.production`

Es allitsd be benne:
- `DB_SERVER`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `CORS_ORIGIN`

Pelda:
```env
DB_USER=sa
DB_PASSWORD=very-strong-password
DB_SERVER=your-sql-host
DB_PORT=1433
DB_NAME=ResQ
JWT_SECRET=very-long-random-secret
CORS_ORIGIN=https://resq.yourdomain.com
PORT=5000
```

### 2. Docker publish

A gyokerben ezek a fajlok kellenek a publishhoz:
- [Dockerfile](D:/ResQ/Dockerfile)
- [docker-compose.publish.yml](D:/ResQ/docker-compose.publish.yml)

Inditas:
```powershell
docker compose -f docker-compose.publish.yml up -d --build
```

Ez a kontenert a szerver `80`-as portjara teszi ki.

### 2/B. Publish Docker nelkul

Ha nincs Docker telepitve, akkor futtathatod sima Node vagy PM2 alol is.

#### PM2 telepites
```powershell
npm install -g pm2
```

#### Production env
Masold ezt:
- [backend/.env.production.example](D:/ResQ/backend/.env.production.example)

Erre:
- `backend/.env.production`

#### Inditas PM2-vel
```powershell
cd D:\ResQ
pm2 start ecosystem.config.cjs
pm2 save
```

PM2 config:
- [ecosystem.config.cjs](D:/ResQ/ecosystem.config.cjs)

Ekkor a backend production modban indul, es automatikusan a `backend/.env.production` fajlt tolti be.

#### Inditas PM2 nelkul
```powershell
cd D:\ResQ\backend
$env:NODE_ENV="production"
node src/server.js
```

Ilyenkor a frontendet mar nem kell kulon `serve`-val inditani, mert a backend kiszolgalja a `public` mappat is.

### 3. Domain beallitasa

A domain DNS-ben allits be egy `A` recordot a szerver IP-jere.

Pelda:
- `resq.yourdomain.com` -> `YOUR_SERVER_IP`

### 4. Reverse proxy

Ha a Node app a szerveren a `5000` porton fut, akkor a domaint erdemes reverse proxyval raengedni.

Egyszeru opciok:
- IIS + ARR Windows szerveren
- Nginx Windows/Linux szerveren
- Caddy
- Nginx Proxy Manager

### 5. Hasznalat

Ha a szerveren fut az app es a domain az IP-re mutat, akkor az oldal innen elerheto:

```text
http://resq.yourdomain.com
```

Ha HTTPS kell, a legegyszerubb, ha a domain ele teszel egy reverse proxyt vagy cloud szolgaltatast:
- Nginx Proxy Manager
- Caddy
- Cloudflare

## Fontos

- A backend SQL Server kapcsolatra epul, tehat a production szervernek el kell ernie az SQL Server peldanyt.
- Ha a database kulon gepen fut, a tuzfalban engedelyezni kell a megfelelo portot.
- Ha named instance-t hasznalsz, productionben altalaban stabilabb fix `DB_PORT`-ot megadni.
