const { spawn } = require('child_process');

function runCommand(cmd, args = [], label = '', delay = 0) {
  return new Promise((resolve) => {
    if (label) console.log(label);

    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      console.log(`✅ Proses ${[cmd, ...args].join(' ')} selesai (exit code: ${code})`);
      if (delay > 0) {
        console.log(`⏳ Menunggu ${delay / 1000} detik...`);
        setTimeout(resolve, delay);
      } else {
        resolve();
      }
    });
  });
}

// Fungsi utama yang akan dijalankan setiap 3 jam
async function executeTask() {
  console.log(`\n[${new Date().toLocaleString()}] Dimulai: Siklus Pengecekan Saldo`);

  await runCommand('node', ['capture'], '\n========= Proses Capture =========', 20000);
  await runCommand('node', ['trigger'], '\n========= Proses Send =========');

  console.log(`\n[${new Date().toLocaleString()}] Selesai: Menunggu 3 jam untuk siklus berikutnya...`);
}

// 1. Jalankan langsung saat script di-start
executeTask();
// 2. Pasang interval 3 jam
const TIGA_JAM = 3 * 60 * 60 * 1000;
setInterval(executeTask, TIGA_JAM);
