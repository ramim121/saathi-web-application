/**
 * PM2 definition for STAGING — api-test.digigramventures.com.
 *
 * Port 4100, process name `saathi-app`, under the **ubuntu** pm2 daemon.
 *
 * This file previously declared `saathi-app` on port **4200**, which is
 * production's port: a chimera that matched staging's name and production's
 * port and was therefore wrong for both. Starting staging from it would have
 * collided with `saathi-app-production` on 4200.
 *
 * Production has its own file: ecosystem.production.config.js.
 *
 * Ports on this box: 3000 shathisheba-admin (root's daemon), 4100 this,
 * 4200 saathi-app-production, 4300 digigram-website (new.digigramventures.com),
 * 4400 digigram-website-production (digigramventures.com).
 */
module.exports = {
  apps: [
    {
      name: 'saathi-app',
      cwd: '/var/www/html/saathi-web-application',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4100',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
