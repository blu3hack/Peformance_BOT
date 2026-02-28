require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { spawn } = require('child_process');

const token = process.env.BOT_TOKEN;
const MY_CHAT_ID = process.env.ALLOWED_CHAT_ID; // Ganti dengan Chat ID Anda
const bot = new TelegramBot(token, { polling: true });

/**
 * Fungsi untuk menjalankan command dan mengirim output ke Telegram
 */
function runCommand(cmd, args = [], label = '', delay = 0) {
  return new Promise((resolve, reject) => {
    if (label) console.log(label);

    let outputData = ''; // Variabel untuk menampung log terminal

    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'pipe'], // 'pipe' agar kita bisa menangkap outputnya
      shell: true,
    });

    // Menangkap output normal (stdout)
    child.stdout.on('data', (data) => {
      const str = data.toString();
      process.stdout.write(str); // Tetap tampilkan di terminal lokal
      outputData += str;
    });

    // Menangkap output error (stderr)
    child.stderr.on('data', (data) => {
      const str = data.toString();
      process.stderr.write(str);
      outputData += `⚠️ ERROR: ${str}`;
    });

    child.on('error', (err) => {
      bot.sendMessage(MY_CHAT_ID, `❌ Gagal menjalankan script: ${err.message}`);
      reject(err);
    });

    child.on('close', async (code) => {
      const status = code === 0 ? '✅ BERHASIL' : '❌ GAGAL';

      // Kirim Ringkasan dan Log ke Telegram
      // Jika log terlalu panjang (> 4000 karakter), Telegram akan error, maka kita potong
      const cleanOutput = outputData.length > 3500 ? outputData.substring(outputData.length - 3500) + '\n...(log dipotong karena terlalu panjang)' : outputData;

      const message = `*LAPORAN TASK*\n` + `━━━━━━━━━━━━━━━\n` + `*Command:* \`${cmd} ${args.join(' ')}\`\n` + `*Status:* ${status}\n` + `*Log Output:*\n\`\`\`\n${cleanOutput || 'Tidak ada output'}\n\`\`\``;

      await bot.sendMessage(MY_CHAT_ID, message, { parse_mode: 'Markdown' });

      if (delay > 0) {
        setTimeout(resolve, delay);
      } else {
        resolve();
      }
    });
  });
}

// Fungsi siklus (Tetap menggunakan pola aman setTimeout)
async function startCycle(taskName, taskFn, intervalMs) {
  try {
    await taskFn();
  } catch (err) {
    console.error(`Error pada ${taskName}:`, err);
  } finally {
    setTimeout(() => startCycle(taskName, taskFn, intervalMs), intervalMs);
  }
}

const taskCapture = async () => {
  console.log(`\n[${new Date().toLocaleString()}] --- Start Capture ---`);
  await runCommand('node', ['capture'], '📸 Memulai Proses Capture...', 20000);
};

const taskTrigger = async () => {
  console.log(`\n[${new Date().toLocaleString()}] --- Start Trigger ---`);
  await runCommand('node', ['trigger'], '🚀 Memulai Proses Trigger...');
};

// Konfigurasi Waktu
const LIMA_MENIT = 5 * 60 * 1000;
const TIGA_JAM = 3 * 60 * 60 * 1000;

// Jalankan Siklus
startCycle('Capture', taskCapture, LIMA_MENIT);
startCycle('Trigger', taskTrigger, TIGA_JAM);
