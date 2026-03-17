module.exports = {
  apps: [
    {
      name: "resq",
      cwd: "./backend",
      script: "src/server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
