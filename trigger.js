require('dotenv').config(); // Load variabel dari .env
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
// Ambil session string dari file .env
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);

(async () => {
  console.log('Menghubungkan menggunakan session yang ada...');

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  // Karena stringSession sudah terisi, client.start() tidak akan minta OTP
  await client.start({
    phoneNumber: async () => '',
    phoneCode: async () => '',
    onError: (err) => console.log('Error:', err),
  });

  const targetId = '@Initiatif_bot';
  const pesan = 'send';

  try {
    await client.sendMessage(targetId, { message: pesan });
    console.log(`🚀 Pesan terkirim ke ${targetId}`);
  } catch (error) {
    console.error('❌ Gagal:', error.message);
  }

  // Jika ini script sekali jalan, tutup koneksi
  await client.disconnect();
  process.exit();
})();
