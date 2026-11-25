# Quiz Live Multiplayer

Progetto base di quiz live con:
- presentatore da smartphone o PC
- ospiti che rispondono dai propri telefoni
- schermo TV con domande e classifica
- 20 domande di esempio
- punteggio con bonus velocità

## Avvio sul computer

1. Installa Node.js (versione LTS).
2. Apri il terminale nella cartella del progetto.
3. Esegui:
   ```bash
   npm install
   npm start
   ```
4. Sul computer apri `http://localhost:3000`.

## Utilizzo con più dispositivi nella stessa rete Wi-Fi

1. Trova l'indirizzo IP locale del computer che avvia il server (es. `192.168.1.20`).
2. Sul cellulare e sulla TV/browser apri `http://192.168.1.20:3000`.
3. Il presentatore crea la partita e comunica il codice.
4. Gli ospiti selezionano "Partecipa" e inseriscono codice e nome.
5. Sulla TV seleziona "Schermo TV" e inserisci lo stesso codice.

Il computer che esegue `npm start` deve rimanere acceso e collegato alla rete.

## Uso da fuori rete / pubblicazione online

Per far partecipare ospiti da reti diverse, il progetto deve essere pubblicato su un hosting Node.js che supporti WebSocket/Socket.IO e HTTPS. Non basta aprire il file HTML direttamente.

## Personalizzazione

Le 20 domande sono in `server.js`, nella costante `QUESTIONS`. Per ogni domanda:
- `q`: testo
- `a`: quattro risposte
- `correct`: indice della risposta corretta (0, 1, 2 o 3)

## Nota

Questa è una prima versione funzionante/prototipo. Non include ancora QR automatico, editor domande da pannello, salvataggio storico o gestione di più round personalizzati.
