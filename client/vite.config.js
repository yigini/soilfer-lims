import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'node:url'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const buildDate = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
        __BUILD_DATE__: JSON.stringify(buildDate),
    },
    build: {
        commonjsOptions: { include: [/node_modules/, /shared[\\/](?:numberParse|reportedValueFormat|nonconformityContract|soilCalculation|resultValueValidation)\.js$/] },
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-charts': ['recharts'],
                    'vendor-maps': ['leaflet', 'react-leaflet'],
                    'vendor-pdf': ['jspdf', 'jspdf-autotable', 'html-to-image'],
                    'vendor-excel': ['xlsx'],
                    'vendor-flow': ['@xyflow/react', 'dagre']
                }
            }
        },
        chunkSizeWarningLimit: 1000
    },
    resolve: { alias: { '@lims/soil-calculation': fileURLToPath(new URL('../shared/soilCalculation.js', import.meta.url)),
        '@lims/result-value-validation': fileURLToPath(new URL('../shared/resultValueValidation.js', import.meta.url)),
        '@lims/number-parse': fileURLToPath(new URL('../shared/numberParse.js', import.meta.url)),
        '@lims/reported-value-format': fileURLToPath(new URL('../shared/reportedValueFormat.js', import.meta.url)),
        '@lims/nonconformity': fileURLToPath(new URL('../shared/nonconformityContract.js', import.meta.url)) } },
    optimizeDeps: { include: ['@lims/number-parse', '@lims/reported-value-format', '@lims/nonconformity', '@lims/soil-calculation', '@lims/result-value-validation'] },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false
            }
        }
    }
})
