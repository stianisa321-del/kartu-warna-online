# Kartu Warna Online (multiplayer)

Game kartu browser sederhana untuk 2–4 pemain. Frontend HTML/CSS/JavaScript dan server Node.js + Socket.IO.

## Menjalankan di komputer
1. Instal Node.js versi LTS dari https://nodejs.org/
2. Ekstrak folder proyek.
3. Buka terminal di folder proyek.
4. Jalankan `npm install`
5. Jalankan `npm start`
6. Buka `http://localhost:3000` di browser.

Untuk bermain bersama lewat internet, server harus di-deploy ke layanan hosting yang mendukung aplikasi Node.js/WebSocket. Setelah ter-deploy, bagikan URL publiknya kepada teman. Semua pemain harus membuka URL server yang sama.

## Deployment
Unggah folder proyek ke repository GitHub lalu buat web service Node.js di penyedia hosting yang mendukung WebSocket. Build command: `npm install`; start command: `npm start`. Atur port melalui environment `PORT` jika diminta oleh hosting.

## Fitur
- Buat ruangan dan kode ruangan enam karakter.
- Gabung ruangan dengan kode.
- 2–4 pemain; hanya host yang bisa memulai.
- Kartu dibagikan oleh server; kartu tangan pemain lain tidak dikirim ke browser.
- Giliran, aksi kartu, pilihan warna Joker, dan status kemenangan disinkronkan real-time.

## Catatan
Ini prototipe edukasi. Aturan disederhanakan; belum ada akun, penyimpanan permanen, sistem reconnect, anti-cheat produksi, dan penanganan lengkap untuk semua variasi aturan. Nama/desain bersifat orisinal dan tidak berafiliasi dengan UNO resmi.
