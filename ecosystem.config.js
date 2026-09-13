module.exports = {
  apps: [
    {
      name: 'saathi-app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4200',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
