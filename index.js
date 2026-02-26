require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log('Starting Performance Bot...');

bot.on('document', async (msg) => {
  try {
    if (!msg.document.mime_type.startsWith('image/')) return;
    console.log('IMAGE DOCUMENT DITERIMA');
    const chatId = msg.chat.id;
    const fileId = msg.document.file_id;
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
    const aiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4.1',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Data berikut adalah achievement (%), di mana <100 berarti tidak tercapai.Buatkan summary KPI realisasi kinerja dengan ketentuan berikut: Maksimal 5 poin utama (≤1024 karakter with spaces). Tampilkan pencapaian tertinggi (↑) dan terendah (↓) untuk setiap KPI berdasarkan seluruh Area/Territory (tanpa agregasi per Region).Tegaskan bahwa achievement <100 = tidak tercapai. Gunakan format ringkas dan profesional. Gunakan simbol untuk efisiensi kata (↑ ↓ ≥ < ✔️ → =). Tambahkan insight singkat per Region (BALNUS, JATENG, JATIM). Fokus pada gap performa, stabilitas KPI, dan area dengan deviasi ekstrem.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const summary = aiResponse.data.choices[0].message.content;
    console.log(summary);
    // summary =
    //   'selamat siang, berdasarkan analisa data gangguan pada gambar yang diterima, total gangguan yang tercatat adalah 150 kejadian. Area dengan jumlah gangguan tertinggi adalah Jakarta Selatan dengan 45 kejadian. Rekomendasi untuk mengurangi gangguan meliputi peningkatan pemeliharaan infrastruktur dan peningkatan pelatihan teknis bagi tim lapangan. Mohon tindak lanjut dari manajemen untuk langkah selanjutnya.';
    // const photoStream = fs.createReadStream(localPath);
    // const sentPhoto = await bot.sendPhoto(process.env.ATASAN_CHAT_ID, photoStream, {
    //   caption: `📌 *Summary Report Performance KPI ASR-ENT - posisi : 2026-02-24*\n\n${summary}`,
    //   parse_mode: 'Markdown',
    // });

    console.log('Berhasil kirim ke atasan. Message ID:', sentPhoto.message_id);
    await bot.sendMessage(chatId, '✅ Summary berhasil dikirim ke atasan.');
    // Optional: hapus file setelah diproses
    fs.unlinkSync(localPath);
  } catch (error) {
    console.error(error.response?.data || error.message);
    bot.sendMessage(msg.chat.id, '❌ Terjadi kesalahan saat analisa.');
  }
});
