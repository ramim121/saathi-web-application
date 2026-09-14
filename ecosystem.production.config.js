/**
 * PM2 definition for PRODUCTION — api.digigramventures.com.
 *
 * Port 4200, process name `saathi-app-production`, under the **ubuntu** pm2
 * daemon (not root's — root runs shathisheba-admin only).
 *
 * The name matters as much as the port. The deploy workflow used to start
 * production from ecosystem.config.js, which names the process `saathi-app` —
 * staging's name — so a production deploy would have taken over staging's
 * identity in pm2.
 *
 * Never `pm2 restart all` on this box: it would bounce production alongside
 * whatever you meant to restart. Always restart by name.
 */
module.exports = {
  apps: [
    {
      name: 'saathi-app-production',
      cwd: '/var/www/html/saathi-web-application-production',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4200',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
