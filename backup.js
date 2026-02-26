require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log('Starting Performance Bot...');

bot.on('message', async (msg) => {
  try {
    // if (!msg.document.mime_type.startsWith('image/')) return;
    console.log('IMAGE DOCUMENT DITERIMA');
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'User';
    let fileId;
    console.log(name);

    // Kalau user kirim DOCUMENT
    if (msg.document) {
      if (!msg.document.mime_type.startsWith('image/')) return;
      fileId = msg.document.file_id;
      console.log('IMAGE DOCUMENT DITERIMA');
    } else if (msg.photo) {
      fileId = msg.photo[msg.photo.length - 1].file_id;
      console.log('PHOTO DITERIMA');
    } else if (msg.chat) {
      console.log('CHAT DITERIMA');
    }

    if (chatId !== parseInt(process.env.ALLOWED_CHAT_ID)) {
      console.log(`Akses chat ID: ${chatId} Ditolak`);
      await bot.sendMessage(chatId, `❌ Maaf, ${name} Kamu tidak memiliki izin untuk menggunakan bot ini.`);
      return;
    }

    // Ambil file path dari Telegram
    const fileInfo = await axios.get(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile?file_id=${fileId}`);
    const filePath = fileInfo.data.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;
    const localPath = path.join(__dirname, 'downloads', `${fileId}.jpg`);

    // Download gambar
    const response = await axios({
      url: fileUrl,
      method: 'GET',
      responseType: 'stream',
    });

    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(localPath);
      response.data.pipe(stream);
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    await bot.sendMessage(chatId, '📊 Gambar diterima, sedang dianalisa...');
    const imageBase64 = fs.readFileSync(localPath, { encoding: 'base64' });

    // Kirim ke AI
    // const aiResponse = await axios.post(
    //   'https://api.openai.com/v1/chat/completions',
    //   {
    //     model: 'gpt-4.1',
    //     messages: [
    //       {
    //         role: 'user',
    //         content: [
    //           {
    //             type: 'text',
    //             text: 'Buat summary singkat, padat, dan jelas (maksimal 500 karakter) dari tabel Reporting ASR-ENT. Nilai yang kurang dari 100 harus dibuat bold karena akan dikirim melalui Telegram. Bedakan antara Region (BALNUS, JATENG, JATIM) dan District (selain itu) dalam penyusunan summary.',
    //           },
    //           {
    //             type: 'image_url',
    //             image_url: {
    //               url: `data:image/jpeg;base64,${imageBase64}`,
    //             },
    //           },
    //         ],
    //       },
    //     ],
    //   },
    //   {
    //     headers: {
    //       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    //       'Content-Type': 'application/json',
    //     },
    //   },
    // );

    // const summary = aiResponse.data.choices[0].message.content;

    summary =
      'selamat siang, berdasarkan analisa data gangguan pada gambar yang diterima, total gangguan yang tercatat adalah 150 kejadian. Area dengan jumlah gangguan tertinggi adalah Jakarta Selatan dengan 45 kejadian. Rekomendasi untuk mengurangi gangguan meliputi peningkatan pemeliharaan infrastruktur dan peningkatan pelatihan teknis bagi tim lapangan. Mohon tindak lanjut dari manajemen untuk langkah selanjutnya.';
    const photoStream = fs.createReadStream(localPath);
    const sentPhoto = await bot.sendPhoto(process.env.ATASAN_CHAT_ID, photoStream, {
      caption: `📌 *Daily Report*\n\n${summary}`,
      parse_mode: 'Markdown',
    });
    // console.log(summary);

    console.log('Berhasil kirim ke atasan. Message ID:', sentPhoto.message_id);
    await bot.sendMessage(chatId, '✅ Summary berhasil dikirim ke atasan.');
    // Optional: hapus file setelah diproses
    fs.unlinkSync(localPath);
  } catch (error) {
    console.error(error.response?.data || error.message);
    bot.sendMessage(msg.chat.id, '❌ Terjadi kesalahan saat analisa.');
  }
});
