# App Budget — versione locale per iPhone, poi Android

Questa versione è pensata per uso personale: non richiede login, non utilizza Base44, non ha un backend e non sincronizza dati con il cloud.

## Architettura
- React + Vite: interfaccia esistente.
- Capacitor: contenitore nativo iOS/Android.
- SQLite sul dispositivo nelle build native, con tabelle locali per transazioni, categorie, budget e conti.
- `localStorage` viene usato soltanto per la preview web di sviluppo; non è il database previsto per l'app installata sul telefono.
- Backup JSON esportabile e ripristinabile dalla sezione **More**.
- Collegamento automatico delle banche/Plaid disabilitato, perché richiede servizi esterni.

## Requisiti
- Node.js 20.19+ (consigliato Node.js 22) e npm.
- Android: Android Studio e Android SDK.
- iOS: macOS con Xcode per compilare e firmare l'app. Da Windows il progetto può essere preparato, ma la compilazione iOS richiede un Mac locale o un servizio macOS remoto.

## Sviluppo web locale su Windows
```bash
npm install
npm run dev
```
La versione web è una preview e usa `localStorage`; i test del database SQLite vanno effettuati sulla build nativa.

## Preparare Android
```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

## Preparare iOS (su Mac o ambiente macOS remoto)
```bash
npm install
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```
Poi, in Xcode, selezionare il team di firma e il proprio iPhone come destinazione.

Se le cartelle `ios` e `android` sono già state generate, dopo le modifiche eseguire `npm run cap:sync`.

## Backup
Da **More → Local data & backup** si può esportare un backup JSON e ripristinarlo in seguito. Conservare una copia fuori dal telefono: disinstallazione o perdita del dispositivo possono causare perdita dei dati locali.

## Limiti della prima conversione
- La sincronizzazione automatica bancaria non è disponibile; inserimento manuale delle transazioni resta il flusso supportato.
- La prima compilazione iOS deve essere eseguita su macOS/Xcode.
- La build e l'installazione nativa devono ancora essere verificate in un ambiente con dipendenze npm installate e toolchain Apple disponibile.
