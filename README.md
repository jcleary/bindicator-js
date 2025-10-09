Setting up with pm2

```bash
cd ~/bindicator-js

# first time, interactive login with QR code, then press CTRL-C
npx @open-wa/wa-automate -p 3800  --session-id bindicator

# adds the service to pm2
npx @open-wa/wa-automate -p 3800  --session-id bindicator --pm2

# get the status
pm2 status 

# manage the service
pm2 stop|start|restart bindicator
```