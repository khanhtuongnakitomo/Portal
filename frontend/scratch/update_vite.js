import fs from 'fs'
const p = 'd:/Coding/Prj/TNEjob/frontend/vite.config.ts'
let content = fs.readFileSync(p, 'utf8')

// Let's replace using regex for server and preview blocks
const newServerAndPreview = `    server: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '5173'),
      strictPort: false,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: process.env.VITE_BACKEND_ORIGIN || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
      watch: {
        ignored: [
          '**/.figma/**',
        ],
      },
    },
    preview: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '5173'),
      allowedHosts: true,
      proxy: {
        '/api': {
          target: process.env.VITE_BACKEND_ORIGIN || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    }`

content = content.replace(/    server: \{[\s\S]*?    preview: \{[\s\S]*?\n    \},/m, newServerAndPreview)
fs.writeFileSync(p, content, 'utf8')
console.log('Successfully replaced via regex!')
