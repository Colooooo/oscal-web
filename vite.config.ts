import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// This editor exists only on the local development server, never in the public build.
function locationEditor(): Plugin {
  return {
    name: 'oscal-local-location-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__oscal/location', async (request, response) => {
        const reply = (status: number, message: string) => {
          response.writeHead(status, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify({ message }))
        }
        const address = request.socket.remoteAddress
        const origin = request.headers.origin
        const localAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
        if (!address || !localAddresses.includes(address) || !origin || origin !== `http://${request.headers.host}`) {
          reply(403, 'Local same-origin requests only')
          return
        }
        if (request.method !== 'POST' || !request.headers['content-type']?.startsWith('application/json')) {
          reply(405, 'POST JSON required')
          return
        }
        try {
          let body = ''
          for await (const chunk of request) {
            body += chunk.toString()
            if (Buffer.byteLength(body) > 1024) { reply(413, 'Request too large'); return }
          }
          const point = JSON.parse(body) as { lat?: unknown; lng?: unknown }
          if (typeof point.lat !== 'number' || typeof point.lng !== 'number' ||
            !Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
            Math.abs(point.lat) > 85 || Math.abs(point.lng) > 180) {
            reply(400, 'Invalid coordinates')
            return
          }
          const filename = resolve(server.config.root, 'src/config/location.json')
          const previous = JSON.parse(await readFile(filename, 'utf8'))
          await writeFile(filename, JSON.stringify({ ...previous, lat: point.lat, lng: point.lng }, null, 2) + '\n', 'utf8')
          reply(200, 'Location saved')
        } catch {
          reply(400, 'Could not save location')
        }
      })
    },
  }
}

export default defineConfig({ plugins: [react(), tailwindcss(), locationEditor()] })
