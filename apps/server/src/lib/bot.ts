import { Telegraf, Markup } from 'telegraf';
import { prisma } from './prisma';

let bot: Telegraf | null = null;

export const startBot = async () => {
  if (bot) {
    try {
      console.log('🛑 Stopping previous bot instance...');
      await bot.stop('RESTART');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.error('Error stopping bot:', e);
    }
    bot = null;
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'TELEGRAM_BOT_TOKEN' }
    });

    const token = setting?.value || process.env.TELEGRAM_BOT_TOKEN;

    if (!token) return;

    bot = new Telegraf(token);

    bot.telegram.setMyCommands([
      { command: 'start', description: 'Tautkan akun dengan Dashboard' },
      { command: 'help', description: 'Lihat panduan penggunaan' },
      { command: 'report', description: 'Pilih dan unduh laporan bulanan' },
    ]);

    bot.start(async (ctx) => {
      const payload = (ctx as any).payload;
      const telegramId = String(ctx.from.id);

      if (payload) {
        const user = await prisma.user.findUnique({ where: { telegramToken: payload } });
        if (user) {
          const telegramUsername = ctx.from.username ? `@${ctx.from.username}` : null;
          await prisma.user.update({
            where: { id: user.id },
            data: { 
              telegramId: telegramId,
              telegramUsername: telegramUsername,
              telegramToken: null 
            }
          });
          return ctx.reply(`✅ *Berhasil!*\n\nAkun ${user.name} sekarang tertaut dengan Telegram (${telegramUsername || telegramId}).`, { parse_mode: 'Markdown' });
        }
      }
      ctx.reply('👋 *Timesheet Bot Aktif!*\n\nKetik /help untuk panduan atau gunakan menu perintah.', { parse_mode: 'Markdown' });
    });

    bot.use(async (ctx, next) => {
      if (!ctx.from) return next();

      const telegramId = String(ctx.from.id);
      const user = await prisma.user.findUnique({ where: { telegramId } });
      
      // FIX: Pengecekan teks yang aman untuk TypeScript
      const message = ctx.message as any;
      if (!user && !(message?.text?.startsWith('/start'))) {
        return ctx.reply('⚠️ *Akses Ditolak*\n\nAnda belum terdaftar. Silakan tautkan akun Anda melalui Dashboard Web.', { parse_mode: 'Markdown' });
      }
      
      ctx.state.user = user;
      return next();
    });

    bot.help((ctx) => {
      const helpMsg = `
📖 *Panduan Penggunaan Timesheet Bot*

1️⃣ *Tanpa Tanggal (Otomatis Hari Ini)*
Format: \`Aktivitas Jam-Jam\`
Contoh: \`Coding Fitur 09:00-11:00\`

2️⃣ *Dengan Tanggal*
Format: \`DD/MM Aktivitas Jam-Jam\`
Contoh: \`01/05 Rapat 10:00-12:00\`

3️⃣ *Laporan Bulanan*
Klik menu /report dan pilih bulan yang diinginkan.
      `;
      ctx.reply(helpMsg, { parse_mode: 'Markdown' });
    });

    bot.command('report', async (ctx) => {
      const months = [
        ['Jan', 'Feb', 'Mar'],
        ['Apr', 'Mei', 'Jun'],
        ['Jul', 'Agu', 'Sep'],
        ['Okt', 'Nov', 'Des']
      ];
      
      const keyboard = Markup.inlineKeyboard(
        months.map((row, i) => 
          row.map((m, j) => {
            const monthNum = (i * 3 + j + 1).toString().padStart(2, '0');
            return Markup.button.callback(m, `report_${monthNum}`);
          })
        )
      );

      ctx.reply('📅 *Pilih Bulan Laporan*:\nSilakan klik salah satu bulan di bawah untuk mengunduh laporan CSV.', { 
        parse_mode: 'Markdown',
        ...keyboard
      });
    });

    bot.action(/report_(\d{2})/, async (ctx) => {
      try {
        const month = parseInt(ctx.match[1]);
        const user = ctx.state.user;
        const year = new Date().getFullYear();
        
        await ctx.answerCbQuery('Menyiapkan laporan...').catch(() => {});
        
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const entries = await prisma.timesheet.findMany({
          where: { userId: user.id, date: { gte: startDate, lte: endDate } },
          orderBy: { date: 'asc' }
        });

        if (entries.length === 0) {
          return ctx.reply(`📭 Tidak ada data untuk bulan ke-${month}.`);
        }

        let csv = 'Date,Start,End,Activity\n';
        entries.forEach(e => {
          csv += `${e.date.toISOString().split('T')[0]},${e.startTime || ''},${e.endTime || ''},"${e.activity}"\n`;
        });

        const safeName = user.name.replace(/\s+/g, '_');
        const filename = `Timesheet_${safeName}_${month}_${year}.csv`;

        return ctx.replyWithDocument(
          { source: Buffer.from(csv), filename },
          { caption: `📄 Laporan Timesheet *${user.name}* (Bulan ${month}/${year})`, parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.error('Report Button Error:', err);
      }
    });

    bot.on('text', async (ctx) => {
      const user = ctx.state.user;
      const text = ctx.message.text.trim();

      const dateRegex = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+(.*)/;
      const timeRegex = /(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/;

      let date = new Date();
      let activityRaw = text;

      const dateMatch = text.match(dateRegex);
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]);
        const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
        date = new Date(year, month - 1, day);
        activityRaw = dateMatch[4];
      }

      const timeMatch = activityRaw.match(timeRegex);
      if (!timeMatch) {
        if (text.startsWith('/')) return; 
        return ctx.reply('⚠️ Waktu belum di-set. Silakan sertakan rentang jamnya (contoh: 09:00-10:00)');
      }

      const startTime = timeMatch[1].replace('.', ':');
      const endTime = timeMatch[2].replace('.', ':');
      const activity = activityRaw.replace(timeMatch[0], '').trim();

      if (!activity) return ctx.reply('⚠️ Aktivitas tidak boleh kosong.');

      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      let duration = (eh + em/60) - (sh + sm/60);
      if (duration < 0) duration += 24;

      try {
        await prisma.timesheet.create({
          data: {
            userId: user.id,
            date,
            activity,
            startTime,
            endTime,
            duration: parseFloat(duration.toFixed(1)),
            source: 'TELEGRAM'
          }
        });

        ctx.reply(`✅ Tersimpan ke tanggal ${date.toLocaleDateString('id-ID')}\n\n📝 *${activity}*\n🕒 ${startTime} - ${endTime} (${duration.toFixed(1)} jam)`, { parse_mode: 'Markdown' });
      } catch (err) {
        ctx.reply('❌ Gagal menyimpan data.');
      }
    });

    bot.launch();
    console.log('🤖 Smart Bot started');
  } catch (error) {
    console.error('Bot Error:', error);
  }
};

export const stopBot = async () => {
  if (bot) {
    try {
      console.log('🛑 Stopping bot...');
      await bot.stop();
    } catch (e) { }
    bot = null;
  }
};

export const restartBot = async () => {
  console.log('🔄 Restarting Telegram Bot...');
  await stopBot();
  await new Promise(resolve => setTimeout(resolve, 2000));
  await startBot();
};
