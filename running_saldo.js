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

async function main() {
  console.log('\n--- Memulai Siklus Eksekusi ---');
  console.log('Melakukan Proses Loaded filedata ke dalam Database');

  await new Promise((r) => setTimeout(r, 5000));
  await runCommand('node', ['alert_ttr_indihome_send'], '\n========= Alert TTR INDIHOME =========', 5000);
  await runCommand('node', ['alert_ttr_indibiz_send'], '\n========= Alert TTR INDIBIZ =========', 5000);

  console.log('\nEksekusi selesai. Menunggu 3 jam untuk siklus berikutnya...');
}

// Konfigurasi Waktu (3 jam dalam milidetik)
const TIGA_JAM = 3 * 60 * 60 * 1000;
main();

// Set interval untuk dijalankan setiap 3 jam ke depan
setInterval(() => {
  main();
}, TIGA_JAM);
