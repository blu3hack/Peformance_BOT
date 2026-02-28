const { spawn } = require('child_process');

function runCommand(cmd, args = [], label = '', delay = 0) {
  return new Promise((resolve, reject) => {
    if (label) console.log(label);

    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
    });

    child.on('error', reject); // Tangani jika command tidak ditemukan

    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ Proses gagal dengan exit code: ${code}`);
      } else {
        console.log(`✅ Selesai: ${cmd} ${args.join(' ')}`);
      }

      if (delay > 0) {
        console.log(`⏳ Delay: ${delay / 1000} detik...`);
        setTimeout(resolve, delay);
      } else {
        resolve();
      }
    });
  });
}

// Gunakan fungsi pembungkus agar eksekusi berurutan dan terjadwal aman
async function startCycle(taskName, taskFn, intervalMs) {
  try {
    await taskFn();
  } catch (err) {
    console.error(`Terjadi kesalahan pada ${taskName}:`, err);
  } finally {
    // Jadwalkan ulang HANYA setelah yang ini selesai
    setTimeout(() => startCycle(taskName, taskFn, intervalMs), intervalMs);
  }
}

const taskCapture = async () => {
  console.log(`\n[${new Date().toLocaleString()}] --- Start Capture ---`);
  await runCommand('node', ['capture'], '', 20000);
};

const taskTrigger = async () => {
  console.log(`\n[${new Date().toLocaleString()}] --- Start Trigger ---`);
  await runCommand('node', ['trigger']);
};

// Konfigurasi Waktu
const SETENGAH_JAM = 30 * 60 * 1000;
const TIGA_JAM = 3 * 60 * 60 * 1000;

// Jalankan
startCycle('Capture', taskCapture, SETENGAH_JAM);
startCycle('Trigger', taskTrigger, TIGA_JAM);
