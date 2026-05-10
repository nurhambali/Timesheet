import { Telegraf } from 'telegraf';
import { prisma } from './prisma';

let bot: Telegraf | null = null;

export const startBot = async () => {
  if (bot) {
    bot.stop('RESTART');
    bot = null;
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'TELEGRAM_BOT_TOKEN' }
    });

    const token = setting?.value || process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      console.warn('⚠️ TELEGRAM_BOT_TOKEN is not set in DB or .env. Bot will not start.');
      return;
    }

    bot = new Telegraf(token);

    // Command: /start
    bot.start(async (ctx) => {
      const username = ctx.from.username ? `@${ctx.from.username}` : '(Belum Punya Username)';
      
      ctx.reply(
        '👋 Halo! Saya adalah Timesheet AI Bot.\n\n' +
        'Jika Admin sudah mendaftarkan Telegram Username Anda, Anda bisa langsung mencatat waktu kerja dengan format:\n\n' +
        '`Proyek, Aktivitas, Durasi, Catatan(opsional)`\n\n' +
        'Contoh:\n`Website A, Coding Frontend, 2, Selesai Header`\n\n' +
        'Jika belum, minta Admin untuk memasukkan Username Telegram Anda: ' + username,
        { parse_mode: 'Markdown' }
      );
    });

    // Command: /report
    bot.command('report', async (ctx) => {
      const telegramUsername = ctx.from.username;

      if (!telegramUsername) {
        return ctx.reply('⚠️ Anda harus mengatur Username di pengaturan akun Telegram Anda sebelum bisa menggunakan bot ini.');
      }

      const user = await prisma.user.findFirst({
        where: { telegramId: { equals: telegramUsername } },
      });

      if (!user) {
        return ctx.reply(`🔒 Akun Anda belum terdaftar. Beritahu Admin Username Telegram Anda: @${telegramUsername}`);
      }

      // Ambil data timesheet
      const entries = await prisma.timesheet.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
      });

      if (entries.length === 0) {
        return ctx.reply('📭 Anda belum memiliki catatan waktu kerja (timesheet).');
      }

      // Buat CSV in memory
      let csvContent = 'Date,Start,End,Total Hour,Activity / Remark\n';
      entries.forEach((entry) => {
        const date = new Date(entry.date).toLocaleDateString('en-GB');
        const start = entry.startTime || '-';
        const end = entry.endTime || '-';
        const duration = entry.duration;
        const activity = `"${entry.activity.replace(/"/g, '""')}"`;
        
        csvContent += `${date},${start},${end},${duration},${activity}\n`;
      });

      const buffer = Buffer.from(csvContent, 'utf-8');

      // Kirim dokumen
      await ctx.replyWithDocument(
        { source: buffer, filename: `Timesheet_${telegramUsername}_${new Date().toISOString().split('T')[0]}.csv` },
        { caption: '📄 Ini file CSV Laporan Timesheet Anda.' }
      );
    });

    // Handle Text Messages (Timesheet Entry)
    bot.on('text', async (ctx) => {
      const telegramUsername = ctx.from.username;

      if (!telegramUsername) {
        return ctx.reply('⚠️ Anda harus mengatur Username di pengaturan akun Telegram Anda sebelum bisa menggunakan bot ini.');
      }

      const text = ctx.message.text;

      if (text.startsWith('/')) return;

      try {
        // Cari user yang telegramId-nya cocok dengan username ini (case insensitive)
        // Note: Field di DB tetap bernama telegramId, tapi isinya username
        const user = await prisma.user.findFirst({
          where: { 
            telegramId: {
              equals: telegramUsername, // Kita asumsikan saat input di web huruf kecil/besar sudah disamakan
            }
          },
        });

        if (!user) {
          return ctx.reply(`🔒 Akun Anda belum terdaftar. Beritahu Admin Username Telegram Anda: @${telegramUsername}`);
        }

        const parts = text.split(',').map((p) => p.trim());
        
        if (parts.length < 3) {
          return ctx.reply('⚠️ Format pesan tidak sesuai.\nGunakan: `Proyek, Aktivitas, Durasi`', { parse_mode: 'Markdown' });
        }

        const project = parts[0];
        const activity = parts[1];
        const durationStr = parts[2];
        const note = parts[3] || '';

        const duration = parseFloat(durationStr);

        if (isNaN(duration)) {
          return ctx.reply('⚠️ Durasi harus berupa angka (contoh: 2 atau 1.5).');
        }

        await prisma.timesheet.create({
          data: {
            project,
            activity,
            duration,
            note,
            date: new Date(),
            userId: user.id,
            source: 'TELEGRAM'
          },
        });

        ctx.reply(`✅ Catatan berhasil disimpan!\n\n📂 Proyek: ${project}\n⏱ Durasi: ${duration} jam\n📝 Aktivitas: ${activity}`);

      } catch (error) {
        console.error('Error processing timesheet:', error);
        ctx.reply('❌ Gagal menyimpan catatan. Terjadi kesalahan internal.');
      }
    });

    bot.launch().then(() => {
      console.log('🤖 Telegram Bot is up and running via Long Polling');
    }).catch((err) => {
      console.error('⚠️ Failed to start Telegram Bot:', err);
    });

  } catch (error) {
    console.error('Failed to initialize bot:', error);
  }
};

export const restartBot = async () => {
  console.log('🔄 Restarting Telegram Bot...');
  await startBot();
};
