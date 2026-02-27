// loadfile.js
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
  await runCommand('node', ['capture'], '\n========= Proses Capture =========', 20000);
  await runCommand('node', ['send'], '\n========= Proses Send =========');
}
main();
