import nodemailer from 'nodemailer'
export function createMailer(env) {
  if (!env.SMTP_HOST || !env.SMTP_FROM || !env.SMTP_USER || !env.SMTP_PASSWORD) return null
  const transporter = nodemailer.createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_PORT === '465', requireTLS: env.SMTP_PORT !== '465', auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }, connectionTimeout: 10000, socketTimeout: 10000 })
  let active=0
  return async message => {
    if(active>=4) throw new Error('Servicio de correo ocupado.')
    active++
    try {return await transporter.sendMail({ ...message, from: env.SMTP_FROM, disableFileAccess: true, disableUrlAccess: true })}
    finally {active--}
  }
}
