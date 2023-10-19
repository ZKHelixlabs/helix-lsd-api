module.exports = {
  apps: [
    {
      name: 'helix-lsd-api',
      script: 'node',
      args: 'build/server.js',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 5000,
      out_file: 'logs/helix-lsd-api/normal.log',
      error_file: 'logs/helix-lsd-api/error.log',
      combine_logs: true,
    },
    {
      name: 'helix-cardano-node',
      script: 'cardano-node',
      args: 'run --config $HOME/cardano/mainnet/config.json --database-path $HOME/cardano/mainnet/db/ --socket-path $HOME/cardano/mainnet/db/node.socket --host-addr 0.0.0.0 --port 1337 --topology $HOME/cardano/mainnet/topology.json',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 5000,
      out_file: 'logs/helix-cardano-node/normal.log',
      error_file: 'logs/helix-cardano-node/error.log',
      combine_logs: true,
    },
  ]
};