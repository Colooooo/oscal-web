import { DatabaseSync, backup } from 'node:sqlite'
import { mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { openDatabase, createApp } from '../server/index.mjs'
const [command,id] = process.argv.slice(2)
if (!['backup','check-backup','orders','show','reconcile','close-reservation','cancel-request'].includes(command)) throw new Error('Comandos: backup, check-backup archivo, orders, show ID, reconcile ID, close-reservation ID, cancel-request ID')
if (command==='check-backup') {
  const path=resolve(id || '')
  if (!id || !existsSync(path)) throw new Error('Indicá un backup existente.')
  const db=new DatabaseSync(path,{readOnly:true})
  if (db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok') throw new Error('Backup dañado.')
  const directory=resolve('server/backups'); mkdirSync(directory,{recursive:true})
  const restoredPath=resolve(directory,`restore-check-${Date.now()}.sqlite`)
  await backup(db,restoredPath)
  const restored=new DatabaseSync(restoredPath)
  if (restored.prepare('PRAGMA integrity_check').get().integrity_check!=='ok') throw new Error('Falló la restauración de prueba.')
  db.exec('PRAGMA query_only=ON')
  // Read every table from the snapshot to detect unreadable content, without replacing live data.
  const counts={}
  for (const row of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) counts[row.name]=db.prepare(`SELECT count(*) AS n FROM "${row.name.replaceAll('"','""')}"`).get().n
  console.log(JSON.stringify({integrity:'ok',restoredCopy:restoredPath,tables:counts},null,2)); restored.close(); db.close()
} else {
  const db=openDatabase()
  try {
    if (command==='backup') {
      const directory=resolve('server/backups'); mkdirSync(directory,{recursive:true})
      const path=resolve(directory,`oscal-${new Date().toISOString().replaceAll(':','-')}.sqlite`)
      await backup(db,path); console.log(path)
    } else if (command==='orders') console.log(JSON.stringify(db.prepare('SELECT id,status,total,created FROM orders ORDER BY created DESC LIMIT 100').all(),null,2))
    else {
      if (!/^[a-f0-9-]{36}$/.test(id || '')) throw new Error('ID inválido.')
      const order=db.prepare('SELECT * FROM orders WHERE id=?').get(id)
      if (!order) throw new Error('Pedido no encontrado.')
      if (command==='show') console.log(JSON.stringify({id:order.id,status:order.status,total:order.total,created:order.created,...JSON.parse(order.data)},null,2))
      if (command==='cancel-request') {
        if (!['received','awaiting_shipping','demo'].includes(order.status) || order.preference) throw new Error('No es una solicitud sin pago. Conciliá antes de cancelar.')
        db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(id); console.log('Solicitud cancelada; no tenía reserva ni cobro.')
      }
      if (['reconcile','close-reservation'].includes(command)) {
        if (!process.env.MERCADOPAGO_ACCESS_TOKEN) throw new Error('Falta la configuración de Mercado Pago.')
        const {server,payments}=createApp({db})
        try {
          if (command==='close-reservation') await payments.closeReservation(id)
          else if (order.payment) await payments.reconcile(order.payment,id)
          else throw new Error('No hay ID de pago confirmado. Revisar la operación en Mercado Pago antes de liberar reservas.')
          console.log('Operación conciliada.')
        } finally {server.close()}
      }
    }
  } finally {db.close()}
}
