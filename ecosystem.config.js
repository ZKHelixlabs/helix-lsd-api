module.exports = {
  apps: [
    {
      name: 'helix-lsd-api',
      script: 'node',
      args: 'prod/server.js',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 5000,
      out_file: 'logs/helix-lsd-api/normal.log',
      error_file: 'logs/helix-lsd-api/error.log',
      combine_logs: true,
    },
  ]
};